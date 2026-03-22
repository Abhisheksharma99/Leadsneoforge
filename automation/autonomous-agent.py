#!/usr/bin/env python3
"""
ForgeCadNeo Autonomous Marketing Agent
=========================================
A Claude-powered daemon that continuously and autonomously handles all
marketing tasks: Reddit scanning, reply generation, content posting,
engagement analysis, and fresh content generation.

Unlike traditional cron-based scripts, this agent THINKS about what to
do next. Each loop iteration gathers current state, asks Claude for a
decision, executes the chosen action, and logs the result.

Architecture:
    while True:
        1. Gather state (posts, replies, Reddit matches, engagement)
        2. Ask Claude: "Given current state, what should I do next?"
        3. Execute Claude's decision
        4. Log action and results
        5. Sleep and repeat

Usage:
    python autonomous-agent.py                  # Start daemon
    python autonomous-agent.py --daemon         # Start daemon (explicit)
    python autonomous-agent.py --once           # Single decision cycle
    python autonomous-agent.py --dry-run        # Show decisions, don't execute
    python autonomous-agent.py --status         # Show current agent state
    python autonomous-agent.py --report         # Generate daily report

Environment variables required:
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
    ANTHROPIC_API_KEY

Install:
    pip install -r requirements.txt
"""

import argparse
import atexit
import json
import logging
import os
import signal
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# =============================================================================
# PATH SETUP
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

# Load .env file if present
try:
    from dotenv import load_dotenv
    env_file = SCRIPT_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass

# =============================================================================
# IMPORTS FROM EXISTING MODULES
# =============================================================================
# The existing automation scripts use hyphenated filenames (claude-bot.py,
# reddit-reply-bot.py). Python cannot import these with `import` statements,
# so we use importlib to load them by file path.

import importlib.util

def _import_from_file(module_name: str, file_path: Path):
    """Import a Python module from a file path (supports hyphenated filenames)."""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

# Import claude-bot.py
_claude_bot = _import_from_file("claude_bot", SCRIPT_DIR / "claude-bot.py")
ClaudeBot = _claude_bot.ClaudeBot
FORGECADNEO_CONTEXT = _claude_bot.FORGECADNEO_CONTEXT

# Import agent_state.py (underscore name, normal import)
from agent_state import AgentState, now_utc, now_et, today_str

# Import reddit-reply-bot.py
_reply_bot = _import_from_file("reddit_reply_bot", SCRIPT_DIR / "reddit-reply-bot.py")
create_reddit_client = _reply_bot.create_reddit_client
scan_subreddits = _reply_bot.scan_subreddits
load_seen_ids = _reply_bot.load_seen_ids
save_seen_ids = _reply_bot.save_seen_ids
load_replied_users = _reply_bot.load_replied_users
save_replied_users = _reply_bot.save_replied_users
DEFAULT_KEYWORDS = _reply_bot.DEFAULT_KEYWORDS
DEFAULT_SUBREDDITS = _reply_bot.DEFAULT_SUBREDDITS

# =============================================================================
# CONFIGURATION
# =============================================================================

PID_FILE = SCRIPT_DIR / "agent.pid"
LOG_FILE = SCRIPT_DIR / "agent.log"
DECISION_MODEL = "claude-sonnet-4-6"   # Fast model for decisions
CONTENT_MODEL = "claude-sonnet-4-6"    # Default for content generation

# Loop timing
DEFAULT_LOOP_INTERVAL_SECONDS = 300     # 5 minutes between decision cycles
CRASH_BACKOFF_BASE_SECONDS = 30         # Base backoff on crash
CRASH_BACKOFF_MAX_SECONDS = 600         # Max backoff (10 minutes)

# Logging
logger = logging.getLogger("autonomous-agent")

# Global shutdown flag
_shutdown_requested = False


# =============================================================================
# SIGNAL HANDLING & PID MANAGEMENT
# =============================================================================

def signal_handler(signum, frame):
    """Handle SIGINT/SIGTERM for graceful shutdown."""
    global _shutdown_requested
    sig_name = signal.Signals(signum).name
    logger.info(f"Received {sig_name}. Initiating graceful shutdown...")
    _shutdown_requested = True


def write_pid_file():
    """Write current PID to the PID file. Fails if another instance is running."""
    if PID_FILE.exists():
        try:
            old_pid = int(PID_FILE.read_text().strip())
            # Check if the old process is still running
            try:
                os.kill(old_pid, 0)
                # Process exists
                logger.error(
                    f"Another agent instance is already running (PID {old_pid}). "
                    f"Stop it first with: kill {old_pid}"
                )
                sys.exit(1)
            except ProcessLookupError:
                # Process is dead, clean up stale PID file
                logger.warning(
                    f"Removing stale PID file (PID {old_pid} is not running)"
                )
                PID_FILE.unlink()
            except PermissionError:
                logger.error(
                    f"Cannot check PID {old_pid}. Remove {PID_FILE} manually."
                )
                sys.exit(1)
        except (ValueError, IOError):
            PID_FILE.unlink(missing_ok=True)

    PID_FILE.write_text(str(os.getpid()))
    logger.info(f"PID file written: {PID_FILE} (PID {os.getpid()})")


def remove_pid_file():
    """Remove the PID file on exit."""
    PID_FILE.unlink(missing_ok=True)
    logger.info("PID file removed.")


# =============================================================================
# THE AUTONOMOUS AGENT
# =============================================================================

class AutonomousAgent:
    """
    Claude-powered autonomous marketing agent for ForgeCadNeo.

    Runs a continuous loop where Claude decides what action to take
    based on the current state of all marketing activities.
    """

    def __init__(
        self,
        dry_run: bool = False,
        loop_interval: int = DEFAULT_LOOP_INTERVAL_SECONDS,
    ):
        self.dry_run = dry_run
        self.loop_interval = loop_interval
        self.consecutive_errors = 0

        # Initialize Claude bot (reuse existing module)
        self.claude = ClaudeBot()
        logger.info("Claude bot initialized.")

        # Initialize state manager
        self.state = AgentState()
        self.state.load()
        logger.info("Agent state loaded.")

        # Initialize Reddit client (lazy — only when needed)
        self._reddit = None
        self._reddit_initialized = False

        # Action dispatch table
        self.actions = {
            "scan_reddit": self._action_scan_reddit,
            "reply_to_post": self._action_reply_to_post,
            "post_content": self._action_post_content,
            "generate_fresh_content": self._action_generate_fresh_content,
            "analyze_engagement": self._action_analyze_engagement,
            "wait": self._action_wait,
        }

    @property
    def reddit(self):
        """Lazy-initialize the Reddit client."""
        if not self._reddit_initialized:
            try:
                self._reddit = create_reddit_client()
                self._reddit_initialized = True
                logger.info("Reddit client initialized.")
            except SystemExit:
                logger.warning(
                    "Reddit credentials not available. "
                    "Reddit actions will be skipped."
                )
                self._reddit_initialized = True  # Don't retry
        return self._reddit

    # =========================================================================
    # MAIN LOOP
    # =========================================================================

    def run(self):
        """
        Main autonomous loop. Runs until SIGINT/SIGTERM or crash.

        Each iteration:
        1. Gather and summarize current state
        2. Ask Claude what action to take
        3. Execute the chosen action
        4. Log results
        5. Sleep until next cycle
        """
        global _shutdown_requested
        logger.info("=" * 60)
        logger.info("ForgeCadNeo Autonomous Marketing Agent")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        logger.info(f"Loop interval: {self.loop_interval}s")
        logger.info(f"PID: {os.getpid()}")
        logger.info("=" * 60)

        while not _shutdown_requested:
            try:
                self._run_cycle()
                self.consecutive_errors = 0
            except KeyboardInterrupt:
                logger.info("KeyboardInterrupt received. Shutting down.")
                break
            except Exception as e:
                self.consecutive_errors += 1
                backoff = min(
                    CRASH_BACKOFF_BASE_SECONDS * (2 ** (self.consecutive_errors - 1)),
                    CRASH_BACKOFF_MAX_SECONDS,
                )
                logger.error(
                    f"[!!] Cycle error (attempt {self.consecutive_errors}): {e}"
                )
                logger.error(traceback.format_exc())
                self.state.log_action({
                    "action": "error",
                    "status": "error",
                    "reason": str(e)[:200],
                    "consecutive_errors": self.consecutive_errors,
                })

                if self.consecutive_errors >= 10:
                    logger.error(
                        "10 consecutive errors. Agent stopping to prevent damage."
                    )
                    break

                logger.info(f"Backing off for {backoff}s before retry...")
                self._interruptible_sleep(backoff)
                continue

            # Sleep between cycles
            if not _shutdown_requested:
                logger.info(
                    f"[..] Next cycle in {self.loop_interval}s "
                    f"({self.loop_interval // 60}m {self.loop_interval % 60}s)"
                )
                self._interruptible_sleep(self.loop_interval)

        # Shutdown
        logger.info("Agent shutting down gracefully.")
        self.state.save_daily_report()
        self.state.save()
        logger.info("Final state saved. Goodbye.")

    def run_once(self):
        """Run a single decision cycle, then exit."""
        logger.info("=" * 60)
        logger.info("ForgeCadNeo Autonomous Agent — Single Run")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        logger.info("=" * 60)
        self._run_cycle()
        self.state.save()
        logger.info("Single cycle complete.")

    # =========================================================================
    # DECISION CYCLE
    # =========================================================================

    def _run_cycle(self):
        """Execute one complete decision cycle."""
        logger.info("")
        logger.info("-" * 40)
        logger.info("[>>] Starting decision cycle")

        # 1. Refresh state
        self.state._check_daily_reset()

        # 2. Generate state summary
        state_summary = self.state.summarize()
        logger.debug(f"State summary:\n{state_summary}")

        # 3. Ask Claude what to do
        decision = self._decide_next_action(state_summary)
        if decision is None:
            logger.warning("[??] Claude returned no decision. Waiting.")
            decision = {
                "action": "wait",
                "reason": "Failed to get decision from Claude",
                "params": {"minutes": 10},
            }

        action_name = decision.get("action", "wait")
        reason = decision.get("reason", "No reason given")
        params = decision.get("params", {})

        logger.info(f"[>>] Decision: {action_name}")
        logger.info(f"[>>] Reason: {reason}")

        # 4. Execute the action
        if self.dry_run and action_name not in ("wait", "scan_reddit", "analyze_engagement"):
            logger.info(f"[~~] DRY RUN: Would execute '{action_name}' with params: {json.dumps(params, indent=2)}")
            result = {
                "action": action_name,
                "status": "dry_run",
                "reason": reason,
                "params": params,
            }
        else:
            action_fn = self.actions.get(action_name)
            if action_fn is None:
                logger.warning(f"[??] Unknown action: {action_name}. Waiting instead.")
                result = {
                    "action": action_name,
                    "status": "skipped",
                    "reason": f"Unknown action: {action_name}",
                }
            else:
                result = action_fn(params, reason)

        # 5. Log the action
        self.state.log_action(result)
        logger.info(f"[<<] Result: {result.get('status', 'unknown')}")

    # =========================================================================
    # CLAUDE DECISION-MAKING
    # =========================================================================

    def _decide_next_action(self, state_summary: str) -> Optional[dict]:
        """
        Ask Claude what action to take based on current state.

        Returns a decision dict with keys: action, reason, params
        """
        system_prompt = """You are the decision engine for an autonomous marketing agent for ForgeCadNeo, an AI-powered 2D-to-3D CAD conversion tool.

Your job: Given the current agent state, decide the single best action to take RIGHT NOW.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

Available actions:
1. "scan_reddit" — Scan subreddits for keyword matches. Do this if last scan was >2 hours ago or never.
2. "reply_to_post" — Reply to a matched Reddit post. Requires unhandled matches to exist. Include "match_id" in params.
3. "post_content" — Post the next item from the content queue. Include "content_id" in params if you can identify one.
4. "generate_fresh_content" — Ask Claude to create a new post about a trending/relevant topic. Include "topic" and "platform" in params.
5. "analyze_engagement" — Check metrics on recent posts/replies. Do this periodically (every 4-6 hours).
6. "wait" — Nothing to do right now. Include "minutes" in params (5-60).

Decision rules:
- Max 5 Reddit posts per day, max 10 replies per day (check the rate limits in state)
- If rate limits are hit, wait until they reset
- Space posts 2+ hours apart
- Only reply to posts where ForgeCadNeo is genuinely relevant
- If nothing is urgent, wait 15-30 minutes
- Priority order: replies to hot posts > scanning (if stale) > scheduled content > fresh content > engagement analysis > wait
- Never do an action that the rate limits say is blocked
- If it's quiet hours (11 PM - 7 AM ET), always wait
- If last scan was never done, scan first
- If there are unhandled Reddit matches with good engagement, prioritize replying
- If the content queue has items and we haven't posted recently, post content
- Generate fresh content only if the queue is empty and we haven't generated any today"""

        user_prompt = f"""Current agent state:

{state_summary}

Based on this state, what single action should the agent take right now? Respond with JSON only:
{{
    "action": "scan_reddit|reply_to_post|post_content|generate_fresh_content|analyze_engagement|wait",
    "reason": "brief explanation of why this action",
    "params": {{}}
}}"""

        try:
            response = self.claude._call_claude(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model=DECISION_MODEL,
                max_tokens=500,
                temperature=0.3,  # Low temperature for consistent decisions
            )

            # Parse JSON from response (handle markdown code blocks)
            response = response.strip()
            if response.startswith("```"):
                # Strip markdown code fence
                lines = response.split("\n")
                response = "\n".join(
                    line for line in lines
                    if not line.strip().startswith("```")
                )

            decision = json.loads(response)

            # Validate required fields
            if "action" not in decision:
                logger.warning("Decision missing 'action' field")
                return None

            if decision["action"] not in self.actions:
                logger.warning(f"Decision has unknown action: {decision['action']}")
                decision["action"] = "wait"
                decision["reason"] = f"Unknown action, defaulting to wait"
                decision["params"] = {"minutes": 10}

            return decision

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude decision as JSON: {e}")
            logger.error(f"Raw response: {response[:500]}")
            return None
        except Exception as e:
            logger.error(f"Error getting decision from Claude: {e}")
            return None

    # =========================================================================
    # ACTION IMPLEMENTATIONS
    # =========================================================================

    def _action_scan_reddit(self, params: dict, reason: str) -> dict:
        """Scan subreddits for keyword matches."""
        if self.reddit is None:
            return {
                "action": "scan_reddit",
                "status": "skipped",
                "reason": "Reddit client not available",
            }

        logger.info("[>>] Scanning Reddit for keyword matches...")

        try:
            subreddits = params.get("subreddits", DEFAULT_SUBREDDITS)
            keywords = params.get("keywords", DEFAULT_KEYWORDS)
            limit = params.get("limit_per_sub", 50)

            matches = scan_subreddits(
                self.reddit, subreddits, keywords, limit_per_sub=limit
            )

            # Store matches in state (without PRAW objects)
            self.state.add_reddit_matches(matches)

            return {
                "action": "scan_reddit",
                "status": "success",
                "reason": reason,
                "details": {
                    "subreddits_scanned": len(subreddits),
                    "matches_found": len(matches),
                    "total_matches_in_queue": len(self.state.reddit_matches),
                },
            }

        except Exception as e:
            logger.error(f"Reddit scan failed: {e}")
            return {
                "action": "scan_reddit",
                "status": "error",
                "reason": str(e)[:200],
            }

    def _action_reply_to_post(self, params: dict, reason: str) -> dict:
        """Generate and post a reply to a matched Reddit post."""
        # Check rate limits
        can_reply_ok, can_reply_reason = self.state.can_reply()
        if not can_reply_ok:
            return {
                "action": "reply_to_post",
                "status": "skipped",
                "reason": f"Rate limited: {can_reply_reason}",
            }

        if self.reddit is None:
            return {
                "action": "reply_to_post",
                "status": "skipped",
                "reason": "Reddit client not available",
            }

        # Get the match to reply to
        match_id = params.get("match_id")
        if match_id:
            match = next(
                (m for m in self.state.reddit_matches if m.get("id") == match_id),
                None,
            )
        else:
            match = self.state.get_best_reddit_match()

        if match is None:
            return {
                "action": "reply_to_post",
                "status": "skipped",
                "reason": "No unhandled Reddit matches available",
            }

        logger.info(
            f"[>>] Replying to r/{match.get('subreddit')}: "
            f"\"{match.get('title', '')[:60]}\""
        )

        try:
            # Generate reply using Claude
            reply_text = self.claude.generate_reddit_reply(
                post_title=match.get("title", ""),
                post_body=match.get("selftext", ""),
                subreddit=match.get("subreddit", ""),
            )

            if not reply_text or len(reply_text.strip()) < 50:
                logger.warning("Generated reply too short. Skipping.")
                self.state.mark_match_handled(match["id"], {"status": "skipped_short"})
                return {
                    "action": "reply_to_post",
                    "status": "skipped",
                    "reason": "Generated reply was too short",
                    "details": {"match_id": match["id"]},
                }

            if self.dry_run:
                logger.info(f"[~~] DRY RUN reply preview ({len(reply_text)} chars):")
                for line in reply_text.split("\n")[:6]:
                    logger.info(f"  {line}")
                self.state.mark_match_handled(match["id"], {"status": "dry_run"})
                return {
                    "action": "reply_to_post",
                    "status": "dry_run",
                    "reason": reason,
                    "details": {
                        "match_id": match["id"],
                        "subreddit": match.get("subreddit"),
                        "post_title": match.get("title", "")[:100],
                        "matched_keyword": match.get("matched_keyword"),
                        "reply_length": len(reply_text),
                    },
                }

            # Actually post the reply
            post_id = match["id"]
            submission = self.reddit.submission(id=post_id)
            comment = submission.reply(reply_text)

            result = {
                "status": "posted",
                "comment_id": comment.id,
                "comment_url": f"https://www.reddit.com{comment.permalink}",
            }

            self.state.mark_match_handled(match["id"], result)

            # Track for engagement analysis later
            self.state.update_engagement(
                f"reply_{comment.id}",
                {
                    "type": "reply",
                    "subreddit": match.get("subreddit"),
                    "post_title": match.get("title", "")[:100],
                    "score": 1,
                    "num_comments": 0,
                },
            )

            logger.info(f"[OK] Reply posted: {result['comment_url']}")

            return {
                "action": "reply_to_post",
                "status": "posted",
                "reason": reason,
                "details": {
                    "match_id": match["id"],
                    "subreddit": match.get("subreddit"),
                    "post_title": match.get("title", "")[:100],
                    "matched_keyword": match.get("matched_keyword"),
                    "comment_id": comment.id,
                    "comment_url": result["comment_url"],
                },
            }

        except Exception as e:
            logger.error(f"Reply failed: {e}")
            self.state.mark_match_handled(
                match["id"], {"status": "error", "error": str(e)[:200]}
            )
            return {
                "action": "reply_to_post",
                "status": "error",
                "reason": str(e)[:200],
                "details": {"match_id": match.get("id")},
            }

    def _action_post_content(self, params: dict, reason: str) -> dict:
        """Post the next item from the content queue."""
        # Check rate limits
        can_post_ok, can_post_reason = self.state.can_post()
        if not can_post_ok:
            return {
                "action": "post_content",
                "status": "skipped",
                "reason": f"Rate limited: {can_post_reason}",
            }

        # Get pending content
        pending = self.state.get_pending_content()
        if not pending:
            return {
                "action": "post_content",
                "status": "skipped",
                "reason": "No pending content in queue",
            }

        # Find the content to post
        content_id = params.get("content_id")
        if content_id:
            item = next(
                (p for p in pending if p.get("content_id") == content_id),
                None,
            )
        else:
            item = pending[0]

        if item is None:
            return {
                "action": "post_content",
                "status": "skipped",
                "reason": "Specified content item not found in queue",
            }

        title = item.get("title", "Untitled")
        body = item.get("body", "")
        subreddit = item.get("subreddit")
        content_id = item.get("content_id", "unknown")

        logger.info(f"[>>] Posting content: \"{title[:60]}\"")

        if self.dry_run:
            logger.info(f"[~~] DRY RUN: Would post to r/{subreddit or 'profile'}")
            logger.info(f"[~~] Title: {title[:80]}")
            logger.info(f"[~~] Body preview: {body[:200]}...")
            self.state.mark_content_posted(content_id, {"status": "dry_run"})
            return {
                "action": "post_content",
                "status": "dry_run",
                "reason": reason,
                "details": {
                    "content_id": content_id,
                    "title": title[:100],
                    "subreddit": subreddit,
                    "source": item.get("source"),
                },
            }

        if self.reddit is None:
            return {
                "action": "post_content",
                "status": "skipped",
                "reason": "Reddit client not available",
            }

        try:
            # Post to Reddit
            if subreddit:
                sub = self.reddit.subreddit(subreddit)
                submission = sub.submit(title=title, selftext=body)
            else:
                # Post to user profile
                username = os.environ.get("REDDIT_USERNAME", "")
                sub = self.reddit.subreddit(f"u_{username}")
                submission = sub.submit(title=title, selftext=body)

            result = {
                "status": "posted",
                "post_id": submission.id,
                "post_url": f"https://www.reddit.com{submission.permalink}",
            }

            self.state.mark_content_posted(content_id, result)

            # Track for engagement analysis
            self.state.update_engagement(
                f"post_{submission.id}",
                {
                    "type": "post",
                    "subreddit": subreddit or "profile",
                    "title": title[:100],
                    "score": 1,
                    "num_comments": 0,
                },
            )

            logger.info(f"[OK] Content posted: {result['post_url']}")

            return {
                "action": "post_content",
                "status": "posted",
                "reason": reason,
                "details": {
                    "content_id": content_id,
                    "title": title[:100],
                    "subreddit": subreddit,
                    "post_id": submission.id,
                    "post_url": result["post_url"],
                },
            }

        except Exception as e:
            logger.error(f"Content posting failed: {e}")
            return {
                "action": "post_content",
                "status": "error",
                "reason": str(e)[:200],
                "details": {
                    "content_id": content_id,
                    "title": title[:100],
                },
            }

    def _action_generate_fresh_content(self, params: dict, reason: str) -> dict:
        """Ask Claude to generate a fresh content post."""
        topic = params.get("topic", "AI-powered CAD conversion trends")
        platform = params.get("platform", "reddit")

        logger.info(f"[>>] Generating fresh content about: {topic}")

        try:
            system_prompt = f"""{FORGECADNEO_CONTEXT}

You are creating an original social media post for {platform}. The post should:
1. Be genuinely interesting and valuable to mechanical engineers/CAD users
2. Include ForgeCadNeo only as a natural mention if relevant
3. Follow {platform} best practices for format and tone
4. Be ready to post as-is (no placeholders or brackets)
5. Include a title/headline and body text separately

Respond with JSON:
{{
    "title": "the post title",
    "body": "the full post body text",
    "subreddit": "suggested subreddit if platform is reddit (just the name, no r/)",
    "hashtags": ["relevant", "hashtags"]
}}"""

            user_prompt = f"Create an original {platform} post about: {topic}"

            response = self.claude._call_claude(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model=CONTENT_MODEL,
                max_tokens=1500,
                temperature=0.8,
            )

            # Parse response
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(
                    line for line in lines
                    if not line.strip().startswith("```")
                )

            content = json.loads(response)
            title = content.get("title", "")
            body = content.get("body", "")
            subreddit = content.get("subreddit", "")

            if not title or not body:
                return {
                    "action": "generate_fresh_content",
                    "status": "error",
                    "reason": "Claude returned empty title or body",
                }

            # Add to pending queue (don't post immediately)
            new_item = {
                "source": "ai-generated",
                "section_index": int(time.time()),
                "title": title,
                "body": body,
                "subreddit": subreddit,
                "platform": platform,
                "generated_at": now_utc().isoformat(),
                "topic": topic,
                "content_id": f"ai-generated::{int(time.time())}::{title[:50]}",
            }
            self.state.pending_queue.insert(0, new_item)  # Add to front
            self.state.save()

            logger.info(f"[OK] Generated: \"{title[:60]}\"")

            return {
                "action": "generate_fresh_content",
                "status": "success",
                "reason": reason,
                "details": {
                    "title": title[:100],
                    "subreddit": subreddit,
                    "platform": platform,
                    "topic": topic,
                    "body_length": len(body),
                },
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse generated content: {e}")
            return {
                "action": "generate_fresh_content",
                "status": "error",
                "reason": f"JSON parse error: {e}",
            }
        except Exception as e:
            logger.error(f"Content generation failed: {e}")
            return {
                "action": "generate_fresh_content",
                "status": "error",
                "reason": str(e)[:200],
            }

    def _action_analyze_engagement(self, params: dict, reason: str) -> dict:
        """Check engagement metrics on recent posts and replies."""
        if self.reddit is None:
            return {
                "action": "analyze_engagement",
                "status": "skipped",
                "reason": "Reddit client not available",
            }

        logger.info("[>>] Analyzing engagement on recent posts...")

        tracked = self.state.engagement_data
        if not tracked:
            return {
                "action": "analyze_engagement",
                "status": "skipped",
                "reason": "No posts/replies tracked for engagement analysis",
            }

        updated_count = 0
        analysis_results = []

        for post_key, metrics in list(tracked.items()):
            try:
                post_type = metrics.get("type", "unknown")

                if post_key.startswith("post_"):
                    post_id = post_key.replace("post_", "")
                    submission = self.reddit.submission(id=post_id)
                    new_metrics = {
                        **metrics,
                        "score": submission.score,
                        "num_comments": submission.num_comments,
                        "upvote_ratio": getattr(submission, "upvote_ratio", 0),
                    }
                    self.state.update_engagement(post_key, new_metrics)
                    updated_count += 1
                    analysis_results.append({
                        "id": post_key,
                        "score": submission.score,
                        "comments": submission.num_comments,
                    })

                elif post_key.startswith("reply_"):
                    comment_id = post_key.replace("reply_", "")
                    comment = self.reddit.comment(id=comment_id)
                    new_metrics = {
                        **metrics,
                        "score": comment.score,
                    }
                    self.state.update_engagement(post_key, new_metrics)
                    updated_count += 1
                    analysis_results.append({
                        "id": post_key,
                        "score": comment.score,
                    })

            except Exception as e:
                logger.warning(f"Failed to fetch metrics for {post_key}: {e}")
                continue

            time.sleep(1)  # Rate limit Reddit API calls

        self.state.save()

        # If we have enough data, ask Claude for engagement analysis
        analysis_summary = ""
        if analysis_results and len(analysis_results) >= 3:
            try:
                analysis_summary = self.claude.analyze_post_engagement(
                    post_text=json.dumps(analysis_results, indent=2),
                    metrics={"total_tracked": len(tracked), "updated": updated_count},
                )
            except Exception:
                pass

        logger.info(f"[OK] Updated engagement for {updated_count} items")

        return {
            "action": "analyze_engagement",
            "status": "success",
            "reason": reason,
            "details": {
                "items_checked": len(tracked),
                "items_updated": updated_count,
                "results": analysis_results[:5],
                "analysis": analysis_summary[:500] if analysis_summary else None,
            },
        }

    def _action_wait(self, params: dict, reason: str) -> dict:
        """Wait for a specified number of minutes."""
        minutes = params.get("minutes", 15)
        minutes = max(1, min(60, minutes))  # Clamp to 1-60

        logger.info(f"[..] Waiting {minutes} minutes. Reason: {reason}")

        # Override the loop interval for this cycle
        self.loop_interval = minutes * 60

        return {
            "action": "wait",
            "status": "waiting",
            "reason": reason,
            "details": {"minutes": minutes},
        }

    # =========================================================================
    # UTILITY
    # =========================================================================

    def _interruptible_sleep(self, seconds: int):
        """Sleep that can be interrupted by shutdown signal."""
        global _shutdown_requested
        end_time = time.time() + seconds
        while time.time() < end_time and not _shutdown_requested:
            time.sleep(min(5, end_time - time.time()))


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def setup_logging(log_file: Optional[Path] = None, verbose: bool = False):
    """Configure logging with both file and console output."""
    level = logging.DEBUG if verbose else logging.INFO

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(console_fmt)
    root_logger.addHandler(console_handler)

    # File handler
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(level)
        file_fmt = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_fmt)
        root_logger.addHandler(file_handler)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "ForgeCadNeo Autonomous Marketing Agent - "
            "Claude-powered daemon that autonomously handles all marketing tasks"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start the daemon
  python autonomous-agent.py --daemon

  # Single decision cycle
  python autonomous-agent.py --once

  # Dry run (show decisions without executing)
  python autonomous-agent.py --dry-run --once

  # Show agent status
  python autonomous-agent.py --status

  # Generate daily report
  python autonomous-agent.py --report

  # Run with verbose logging
  python autonomous-agent.py --daemon --verbose
        """,
    )

    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--daemon",
        action="store_true",
        help="Run as a continuous daemon (default behavior)",
    )
    mode_group.add_argument(
        "--once",
        action="store_true",
        help="Run a single decision cycle, then exit",
    )
    mode_group.add_argument(
        "--status",
        action="store_true",
        help="Show current agent state and exit",
    )
    mode_group.add_argument(
        "--report",
        action="store_true",
        help="Generate and print the daily report",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show decisions without executing write actions",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_LOOP_INTERVAL_SECONDS,
        help=f"Seconds between decision cycles (default: {DEFAULT_LOOP_INTERVAL_SECONDS})",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug-level logging",
    )
    parser.add_argument(
        "--no-pid",
        action="store_true",
        help="Skip PID file management (for testing)",
    )

    args = parser.parse_args()

    # Set up logging
    log_file = LOG_FILE if (args.daemon or not args.once) else None
    setup_logging(log_file=log_file, verbose=args.verbose)

    # Status command
    if args.status:
        state = AgentState()
        state.load()
        print(state.format_status())
        return

    # Report command
    if args.report:
        state = AgentState()
        state.load()
        print(state.generate_daily_report())
        return

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # PID file management (only for daemon mode)
    if not args.no_pid and not args.once:
        write_pid_file()
        atexit.register(remove_pid_file)

    # Create and run agent
    agent = AutonomousAgent(
        dry_run=args.dry_run,
        loop_interval=args.interval,
    )

    if args.once:
        agent.run_once()
    else:
        agent.run()


if __name__ == "__main__":
    main()
