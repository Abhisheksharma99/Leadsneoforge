#!/usr/bin/env python3
"""
Agent State Management for ForgeCadNeo Autonomous Marketing Agent
===================================================================
Persistent state tracking, rate limiting, content queue management,
and Reddit match tracking. All state survives process restarts via
JSON serialization.

Usage as module:
    from agent_state import AgentState
    state = AgentState()
    state.load()
    print(state.summarize())
    state.log_action({"action": "scan_reddit", ...})
    state.save()
"""

import json
import logging
import os
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# Default limits (can be overridden by config)
DEFAULT_MAX_POSTS_PER_DAY = 5
DEFAULT_MAX_REPLIES_PER_DAY = 10
DEFAULT_MIN_POST_INTERVAL_SECONDS = 7200   # 2 hours
DEFAULT_MIN_REPLY_INTERVAL_SECONDS = 1800  # 30 minutes
DEFAULT_QUIET_HOURS_START = 23  # 11 PM ET
DEFAULT_QUIET_HOURS_END = 7    # 7 AM ET

# State file paths
DEFAULT_STATE_FILE = SCRIPT_DIR / "agent-state.json"
DEFAULT_LOG_FILE = SCRIPT_DIR / "agent-log.json"
DEFAULT_DAILY_REPORT_DIR = SCRIPT_DIR / "agent-reports"

# Content queue files
CONTENT_QUEUE_FILES = [
    SCRIPT_DIR / "reddit-profile-posts.md",
    SCRIPT_DIR / "reddit-posts-draft.md",
    SCRIPT_DIR / "reddit-saas-indie-posts.md",
    SCRIPT_DIR / "30-day-content-calendar.md",
    SCRIPT_DIR / "content-queue.md",
]

logger = logging.getLogger("agent-state")


# =============================================================================
# HELPER UTILITIES
# =============================================================================

def load_json_file(filepath: Path, default=None):
    """Load a JSON file, returning default on error."""
    if default is None:
        default = {}
    if filepath.exists():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load {filepath}: {e}")
            return default
    return default


def save_json_file(filepath: Path, data):
    """Save data to a JSON file atomically."""
    tmp_path = filepath.with_suffix(".json.tmp")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        tmp_path.replace(filepath)
    except IOError as e:
        logger.error(f"Failed to save {filepath}: {e}")
        if tmp_path.exists():
            tmp_path.unlink()


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def now_et() -> datetime:
    """Get current Eastern Time datetime (approximation without pytz)."""
    try:
        import pytz
        et = pytz.timezone("America/New_York")
        return datetime.now(et)
    except ImportError:
        # Rough EST offset (UTC-5). DST not handled without pytz.
        return now_utc() - timedelta(hours=5)


def today_str() -> str:
    """Get today's date as YYYY-MM-DD in UTC."""
    return now_utc().strftime("%Y-%m-%d")


# =============================================================================
# CONTENT PARSER
# =============================================================================

class ContentParser:
    """Parse markdown content queue files into structured post items."""

    @staticmethod
    def parse_queue_file(filepath: Path) -> list[dict]:
        """
        Parse a markdown queue file into a list of post items.

        Supports the format used across all queue files:
        - Sections delimited by '---' or '## Post N'
        - Key-value pairs like 'status:', 'platform:', etc.
        - Title in **bold** or after 'Title:'
        - Body text after 'Body:' or as the main content

        Returns:
            List of dicts with keys: source, title, body, subreddit,
            platform, status, section_index
        """
        if not filepath.exists():
            return []

        try:
            content = filepath.read_text(encoding="utf-8")
        except IOError:
            return []

        posts = []
        # Split on '---' dividers or '## ' headers
        sections = re.split(r'\n---\n|\n(?=## )', content)

        for i, section in enumerate(sections):
            section = section.strip()
            if not section or len(section) < 50:
                continue

            post = {
                "source": filepath.name,
                "section_index": i,
                "raw_section": section[:500],  # Truncated for state
            }

            # Extract title
            title_match = re.search(
                r'\*\*Title:\*\*\s*(.+?)(?:\n|$)', section
            )
            if not title_match:
                title_match = re.search(
                    r'^##\s+(?:Post\s+\d+\s*[-—]\s*)?(.+?)(?:\n|$)',
                    section, re.MULTILINE
                )
            if title_match:
                post["title"] = title_match.group(1).strip()

            # Extract subreddit
            sub_match = re.search(
                r'\*\*Subreddit:\*\*\s*r/(\w+)', section
            )
            if sub_match:
                post["subreddit"] = sub_match.group(1)

            # Extract status
            status_match = re.search(
                r'[-*]\s*status:\s*(\w+)', section, re.IGNORECASE
            )
            if status_match:
                post["status"] = status_match.group(1).lower()

            # Extract platform
            platform_match = re.search(
                r'[-*]\s*platform:\s*(.+?)(?:\n|$)', section, re.IGNORECASE
            )
            if not platform_match:
                platform_match = re.search(
                    r'\*\*Platform:\*\*\s*(.+?)(?:\n|$)', section
                )
            if platform_match:
                post["platform"] = platform_match.group(1).strip()

            # Extract body
            body_match = re.search(
                r'\*\*Body:\*\*\s*\n([\s\S]+?)(?=\n---|\n##\s|\Z)',
                section
            )
            if body_match:
                post["body"] = body_match.group(1).strip()[:3000]
            elif "### Post Content" in section:
                content_match = re.search(
                    r'### Post Content\s*\n([\s\S]+?)(?=\n###|\n---|\Z)',
                    section
                )
                if content_match:
                    post["body"] = content_match.group(1).strip()[:3000]

            # Only include if we have at least a title or body
            if post.get("title") or post.get("body"):
                posts.append(post)

        return posts


# =============================================================================
# AGENT STATE CLASS
# =============================================================================

class AgentState:
    """
    Persistent state for the autonomous marketing agent.

    Tracks all activity, rate limits, content queues, Reddit matches,
    and engagement data. All state is serialized to disk as JSON and
    survives process restarts.
    """

    def __init__(
        self,
        state_file: Optional[Path] = None,
        log_file: Optional[Path] = None,
        max_posts_per_day: int = DEFAULT_MAX_POSTS_PER_DAY,
        max_replies_per_day: int = DEFAULT_MAX_REPLIES_PER_DAY,
        min_post_interval: int = DEFAULT_MIN_POST_INTERVAL_SECONDS,
        min_reply_interval: int = DEFAULT_MIN_REPLY_INTERVAL_SECONDS,
    ):
        self.state_file = state_file or DEFAULT_STATE_FILE
        self.log_file = log_file or DEFAULT_LOG_FILE

        # Rate limits
        self.max_posts_per_day = max_posts_per_day
        self.max_replies_per_day = max_replies_per_day
        self.min_post_interval = min_post_interval
        self.min_reply_interval = min_reply_interval

        # State fields
        self.posts_today: list[dict] = []
        self.replies_today: list[dict] = []
        self.pending_queue: list[dict] = []
        self.reddit_matches: list[dict] = []
        self.calendar_progress: dict = {}
        self.engagement_data: dict = {}
        self.action_history: list[dict] = []
        self.last_action: Optional[dict] = None
        self.last_action_time: Optional[str] = None
        self.last_scan_time: Optional[str] = None
        self.last_content_load_time: Optional[str] = None
        self.posted_content_ids: list[str] = []  # Track what has been posted
        self.replied_post_ids: list[str] = []    # Track replied Reddit posts
        self.daily_stats: dict = {}
        self.start_time: str = now_utc().isoformat()
        self._state_date: str = today_str()      # For daily reset tracking

    # -------------------------------------------------------------------------
    # Persistence
    # -------------------------------------------------------------------------

    def load(self):
        """Load state from disk."""
        data = load_json_file(self.state_file, {})
        if not data:
            logger.info("No existing state found. Starting fresh.")
            return

        self.posts_today = data.get("posts_today", [])
        self.replies_today = data.get("replies_today", [])
        self.pending_queue = data.get("pending_queue", [])
        self.reddit_matches = data.get("reddit_matches", [])
        self.calendar_progress = data.get("calendar_progress", {})
        self.engagement_data = data.get("engagement_data", {})
        self.action_history = data.get("action_history", [])
        self.last_action = data.get("last_action")
        self.last_action_time = data.get("last_action_time")
        self.last_scan_time = data.get("last_scan_time")
        self.last_content_load_time = data.get("last_content_load_time")
        self.posted_content_ids = data.get("posted_content_ids", [])
        self.replied_post_ids = data.get("replied_post_ids", [])
        self.daily_stats = data.get("daily_stats", {})
        self.start_time = data.get("start_time", now_utc().isoformat())
        self._state_date = data.get("_state_date", today_str())

        # Reset daily counters if it is a new day
        self._check_daily_reset()

        logger.info(
            f"State loaded: {len(self.posts_today)} posts today, "
            f"{len(self.replies_today)} replies today, "
            f"{len(self.pending_queue)} pending items, "
            f"{len(self.reddit_matches)} Reddit matches"
        )

    def save(self):
        """Save state to disk."""
        data = {
            "posts_today": self.posts_today,
            "replies_today": self.replies_today,
            "pending_queue": self.pending_queue,
            "reddit_matches": self.reddit_matches,
            "calendar_progress": self.calendar_progress,
            "engagement_data": self.engagement_data,
            "action_history": self.action_history[-200:],  # Keep last 200
            "last_action": self.last_action,
            "last_action_time": self.last_action_time,
            "last_scan_time": self.last_scan_time,
            "last_content_load_time": self.last_content_load_time,
            "posted_content_ids": self.posted_content_ids[-500:],
            "replied_post_ids": self.replied_post_ids[-2000:],
            "daily_stats": self.daily_stats,
            "start_time": self.start_time,
            "_state_date": self._state_date,
            "_saved_at": now_utc().isoformat(),
        }
        save_json_file(self.state_file, data)

    # -------------------------------------------------------------------------
    # Daily Reset
    # -------------------------------------------------------------------------

    def _check_daily_reset(self):
        """Reset daily counters if a new day has started."""
        today = today_str()
        if self._state_date != today:
            # Archive yesterday's stats
            self.daily_stats[self._state_date] = {
                "posts": len(self.posts_today),
                "replies": len(self.replies_today),
                "actions": len([
                    a for a in self.action_history
                    if a.get("timestamp", "").startswith(self._state_date)
                ]),
            }
            # Keep only last 30 days of stats
            if len(self.daily_stats) > 30:
                oldest_keys = sorted(self.daily_stats.keys())[:-30]
                for k in oldest_keys:
                    del self.daily_stats[k]

            logger.info(
                f"New day detected ({self._state_date} -> {today}). "
                f"Resetting daily counters. "
                f"Yesterday: {len(self.posts_today)} posts, "
                f"{len(self.replies_today)} replies."
            )
            self.posts_today = []
            self.replies_today = []
            self._state_date = today
            self.save()

    # -------------------------------------------------------------------------
    # Rate Limit Checks
    # -------------------------------------------------------------------------

    def can_post(self) -> tuple[bool, str]:
        """Check if we can make a new post right now."""
        self._check_daily_reset()

        # Check daily limit
        if len(self.posts_today) >= self.max_posts_per_day:
            return False, (
                f"Daily post limit reached "
                f"({len(self.posts_today)}/{self.max_posts_per_day})"
            )

        # Check interval
        if self.posts_today:
            last_post_time = self.posts_today[-1].get("timestamp")
            if last_post_time:
                try:
                    last_dt = datetime.fromisoformat(last_post_time)
                    elapsed = (now_utc() - last_dt).total_seconds()
                    if elapsed < self.min_post_interval:
                        remaining = int(self.min_post_interval - elapsed)
                        return False, (
                            f"Must wait {remaining}s before next post "
                            f"(min interval: {self.min_post_interval}s)"
                        )
                except ValueError:
                    pass

        # Check quiet hours
        is_quiet, reason = self._is_quiet_hours()
        if is_quiet:
            return False, reason

        return True, "OK"

    def can_reply(self) -> tuple[bool, str]:
        """Check if we can make a new reply right now."""
        self._check_daily_reset()

        # Check daily limit
        if len(self.replies_today) >= self.max_replies_per_day:
            return False, (
                f"Daily reply limit reached "
                f"({len(self.replies_today)}/{self.max_replies_per_day})"
            )

        # Check interval
        if self.replies_today:
            last_reply_time = self.replies_today[-1].get("timestamp")
            if last_reply_time:
                try:
                    last_dt = datetime.fromisoformat(last_reply_time)
                    elapsed = (now_utc() - last_dt).total_seconds()
                    if elapsed < self.min_reply_interval:
                        remaining = int(self.min_reply_interval - elapsed)
                        return False, (
                            f"Must wait {remaining}s before next reply "
                            f"(min interval: {self.min_reply_interval}s)"
                        )
                except ValueError:
                    pass

        # Check quiet hours
        is_quiet, reason = self._is_quiet_hours()
        if is_quiet:
            return False, reason

        return True, "OK"

    def _is_quiet_hours(self) -> tuple[bool, str]:
        """Check if current time is in quiet hours (11 PM - 7 AM ET)."""
        et_now = now_et()
        hour = et_now.hour
        if hour >= DEFAULT_QUIET_HOURS_START or hour < DEFAULT_QUIET_HOURS_END:
            return True, (
                f"Quiet hours (11 PM - 7 AM ET). "
                f"Current ET time: {et_now.strftime('%I:%M %p')}"
            )
        return False, "OK"

    # -------------------------------------------------------------------------
    # Content Queue Management
    # -------------------------------------------------------------------------

    def load_content_queues(self):
        """Load and merge content from all queue files."""
        all_content = []
        parser = ContentParser()

        for filepath in CONTENT_QUEUE_FILES:
            if filepath.exists():
                items = parser.parse_queue_file(filepath)
                logger.info(f"Loaded {len(items)} items from {filepath.name}")
                all_content.extend(items)

        # Filter out already-posted content
        new_content = []
        for item in all_content:
            content_id = self._make_content_id(item)
            if content_id not in self.posted_content_ids:
                item["content_id"] = content_id
                new_content.append(item)

        self.pending_queue = new_content
        self.last_content_load_time = now_utc().isoformat()
        logger.info(
            f"Content queue: {len(new_content)} pending items "
            f"(filtered {len(all_content) - len(new_content)} already posted)"
        )

    def _make_content_id(self, item: dict) -> str:
        """Generate a deterministic ID for a content item."""
        source = item.get("source", "unknown")
        index = item.get("section_index", 0)
        title = item.get("title", "")[:50]
        return f"{source}::{index}::{title}"

    def get_pending_content(self) -> list[dict]:
        """Get unposted content items, sorted by priority."""
        # Reload if queue is empty or stale (older than 1 hour)
        if not self.pending_queue or not self.last_content_load_time:
            self.load_content_queues()
        else:
            try:
                load_time = datetime.fromisoformat(self.last_content_load_time)
                if (now_utc() - load_time).total_seconds() > 3600:
                    self.load_content_queues()
            except ValueError:
                self.load_content_queues()

        return self.pending_queue

    def mark_content_posted(self, content_id: str, post_result: dict):
        """Mark a content item as posted."""
        self.posted_content_ids.append(content_id)
        self.posts_today.append({
            "content_id": content_id,
            "timestamp": now_utc().isoformat(),
            "result": post_result,
        })
        # Remove from pending queue
        self.pending_queue = [
            item for item in self.pending_queue
            if item.get("content_id") != content_id
        ]
        self.save()

    # -------------------------------------------------------------------------
    # Reddit Match Management
    # -------------------------------------------------------------------------

    def add_reddit_matches(self, matches: list[dict]):
        """Add new Reddit matches from scanning."""
        existing_ids = {m.get("id") for m in self.reddit_matches}
        new_matches = []
        for match in matches:
            if match.get("id") not in existing_ids:
                # Remove non-serializable PRAW objects
                clean_match = {
                    k: v for k, v in match.items()
                    if k != "praw_submission"
                }
                clean_match["found_at"] = now_utc().isoformat()
                clean_match["handled"] = False
                new_matches.append(clean_match)

        self.reddit_matches.extend(new_matches)
        self.last_scan_time = now_utc().isoformat()

        # Keep only last 200 matches
        self.reddit_matches = self.reddit_matches[-200:]

        if new_matches:
            logger.info(f"Added {len(new_matches)} new Reddit matches")
        self.save()

    def get_best_reddit_match(self) -> Optional[dict]:
        """
        Get the highest-engagement unhandled Reddit match.

        Prioritizes: higher score + more comments = better target.
        """
        unhandled = [
            m for m in self.reddit_matches
            if not m.get("handled", False)
            and m.get("id") not in self.replied_post_ids
        ]
        if not unhandled:
            return None

        # Sort by engagement (score + comments)
        unhandled.sort(
            key=lambda m: m.get("score", 0) + m.get("num_comments", 0),
            reverse=True,
        )
        return unhandled[0]

    def mark_match_handled(self, match_id: str, reply_result: dict):
        """Mark a Reddit match as handled (replied to)."""
        for match in self.reddit_matches:
            if match.get("id") == match_id:
                match["handled"] = True
                match["handled_at"] = now_utc().isoformat()
                match["result"] = reply_result
                break

        self.replied_post_ids.append(match_id)
        self.replies_today.append({
            "match_id": match_id,
            "timestamp": now_utc().isoformat(),
            "result": reply_result,
        })
        self.save()

    # -------------------------------------------------------------------------
    # Action Logging
    # -------------------------------------------------------------------------

    def log_action(self, action_result: dict):
        """Log an executed action and persist state."""
        entry = {
            "timestamp": now_utc().isoformat(),
            **action_result,
        }
        self.action_history.append(entry)
        self.last_action = entry
        self.last_action_time = entry["timestamp"]

        # Also append to the persistent action log file
        log_data = load_json_file(self.log_file, [])
        if isinstance(log_data, list):
            log_data.append(entry)
            # Keep last 2000 entries
            log_data = log_data[-2000:]
            save_json_file(self.log_file, log_data)

        self.save()

    # -------------------------------------------------------------------------
    # Engagement Tracking
    # -------------------------------------------------------------------------

    def update_engagement(self, post_id: str, metrics: dict):
        """Update engagement metrics for a tracked post/reply."""
        self.engagement_data[post_id] = {
            "updated_at": now_utc().isoformat(),
            **metrics,
        }
        # Keep only last 100 entries
        if len(self.engagement_data) > 100:
            sorted_keys = sorted(
                self.engagement_data.keys(),
                key=lambda k: self.engagement_data[k].get("updated_at", ""),
            )
            for k in sorted_keys[:-100]:
                del self.engagement_data[k]

    # -------------------------------------------------------------------------
    # State Summary (for Claude decision-making)
    # -------------------------------------------------------------------------

    def summarize(self) -> str:
        """
        Generate a human-readable state summary for Claude to reason about.

        This is the primary interface between the state system and the
        autonomous agent's decision-making loop.
        """
        self._check_daily_reset()
        et_now = now_et()

        # Time info
        lines = [
            f"=== AGENT STATE SUMMARY ===",
            f"Current time (ET): {et_now.strftime('%A %B %d, %Y %I:%M %p ET')}",
            f"Agent uptime since: {self.start_time}",
            "",
        ]

        # Rate limits
        can_post_ok, can_post_reason = self.can_post()
        can_reply_ok, can_reply_reason = self.can_reply()
        lines.extend([
            f"--- RATE LIMITS ---",
            f"Posts today: {len(self.posts_today)}/{self.max_posts_per_day}"
            f" | Can post: {'YES' if can_post_ok else f'NO ({can_post_reason})'}",
            f"Replies today: {len(self.replies_today)}/{self.max_replies_per_day}"
            f" | Can reply: {'YES' if can_reply_ok else f'NO ({can_reply_reason})'}",
            "",
        ])

        # Last action
        if self.last_action:
            action_name = self.last_action.get("action", "unknown")
            action_status = self.last_action.get("status", "unknown")
            lines.append(
                f"--- LAST ACTION ---"
            )
            lines.append(
                f"Action: {action_name} | Status: {action_status} "
                f"| Time: {self.last_action_time}"
            )
            if "reason" in self.last_action:
                lines.append(f"Reason: {self.last_action['reason']}")
            lines.append("")

        # Reddit matches
        unhandled_matches = [
            m for m in self.reddit_matches
            if not m.get("handled", False)
            and m.get("id") not in self.replied_post_ids
        ]
        lines.append(f"--- REDDIT MATCHES ---")
        lines.append(
            f"Total matches: {len(self.reddit_matches)} | "
            f"Unhandled: {len(unhandled_matches)}"
        )
        if self.last_scan_time:
            lines.append(f"Last scan: {self.last_scan_time}")
            try:
                scan_dt = datetime.fromisoformat(self.last_scan_time)
                scan_age_min = (now_utc() - scan_dt).total_seconds() / 60
                lines.append(f"Scan age: {scan_age_min:.0f} minutes ago")
            except ValueError:
                pass
        else:
            lines.append("Last scan: NEVER (should scan immediately)")

        # Show top 3 unhandled matches
        if unhandled_matches:
            top = sorted(
                unhandled_matches,
                key=lambda m: m.get("score", 0) + m.get("num_comments", 0),
                reverse=True,
            )[:3]
            lines.append("Top unhandled matches:")
            for m in top:
                lines.append(
                    f"  - r/{m.get('subreddit', '?')}: "
                    f"\"{m.get('title', '?')[:60]}\" "
                    f"(score: {m.get('score', 0)}, "
                    f"comments: {m.get('num_comments', 0)}, "
                    f"keyword: \"{m.get('matched_keyword', '?')}\")"
                )
        lines.append("")

        # Content queue
        pending = self.get_pending_content()
        lines.append(f"--- CONTENT QUEUE ---")
        lines.append(f"Pending items: {len(pending)}")
        if pending:
            # Show first 3 pending items
            for item in pending[:3]:
                source = item.get("source", "?")
                title = item.get("title", "untitled")[:50]
                sub = item.get("subreddit", "profile")
                lines.append(f"  - [{source}] r/{sub}: \"{title}\"")
        lines.append("")

        # Engagement summary
        if self.engagement_data:
            lines.append(f"--- ENGAGEMENT DATA ---")
            lines.append(f"Tracking {len(self.engagement_data)} posts/replies")
            # Show recent engagement
            recent = sorted(
                self.engagement_data.items(),
                key=lambda kv: kv[1].get("updated_at", ""),
                reverse=True,
            )[:3]
            for post_id, metrics in recent:
                score = metrics.get("score", 0)
                comments = metrics.get("num_comments", 0)
                lines.append(
                    f"  - {post_id}: score={score}, comments={comments}"
                )
            lines.append("")

        # Daily stats history
        if self.daily_stats:
            lines.append(f"--- RECENT DAILY STATS ---")
            recent_days = sorted(self.daily_stats.keys(), reverse=True)[:5]
            for day in recent_days:
                stats = self.daily_stats[day]
                lines.append(
                    f"  {day}: {stats.get('posts', 0)} posts, "
                    f"{stats.get('replies', 0)} replies, "
                    f"{stats.get('actions', 0)} total actions"
                )
            lines.append("")

        # Today's actions summary
        today_actions = [
            a for a in self.action_history
            if a.get("timestamp", "").startswith(today_str())
        ]
        if today_actions:
            lines.append(f"--- TODAY'S ACTIONS ({len(today_actions)} total) ---")
            for a in today_actions[-5:]:
                action_name = a.get("action", "?")
                status = a.get("status", "?")
                ts = a.get("timestamp", "?")[11:19]  # HH:MM:SS
                lines.append(f"  {ts} | {action_name} | {status}")
            lines.append("")

        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # Status Display
    # -------------------------------------------------------------------------

    def format_status(self) -> str:
        """Format a compact status display for CLI output."""
        self._check_daily_reset()
        et_now = now_et()

        can_post_ok, can_post_reason = self.can_post()
        can_reply_ok, can_reply_reason = self.can_reply()

        unhandled = len([
            m for m in self.reddit_matches
            if not m.get("handled", False)
            and m.get("id") not in self.replied_post_ids
        ])

        pending = len(self.get_pending_content())

        lines = [
            "",
            "ForgeCadNeo Autonomous Marketing Agent",
            "=" * 45,
            f"Time (ET):         {et_now.strftime('%Y-%m-%d %I:%M %p')}",
            f"Agent up since:    {self.start_time[:19]}",
            f"",
            f"Posts today:        {len(self.posts_today)}/{self.max_posts_per_day}"
            f"  {'[OK]' if can_post_ok else f'[BLOCKED: {can_post_reason}]'}",
            f"Replies today:      {len(self.replies_today)}/{self.max_replies_per_day}"
            f"  {'[OK]' if can_reply_ok else f'[BLOCKED: {can_reply_reason}]'}",
            f"",
            f"Reddit matches:     {len(self.reddit_matches)} total, {unhandled} unhandled",
            f"Content queue:      {pending} pending items",
            f"Last scan:          {self.last_scan_time or 'Never'}",
            f"Last action:        {self.last_action.get('action', 'None') if self.last_action else 'None'}"
            f" at {self.last_action_time or 'N/A'}",
            f"Total actions:      {len(self.action_history)}",
            f"",
        ]

        # Recent action history
        recent = self.action_history[-10:]
        if recent:
            lines.append("Recent actions:")
            for a in recent:
                ts = a.get("timestamp", "?")[11:19]
                action = a.get("action", "?")
                status = a.get("status", "?")
                icon = {
                    "success": "[OK]",
                    "posted": "[OK]",
                    "skipped": "[--]",
                    "error": "[!!]",
                    "dry_run": "[~~]",
                    "waiting": "[..]",
                }.get(status, "[??]")
                lines.append(f"  {icon} {ts} {action}: {a.get('reason', '')[:60]}")

        lines.append("")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # Daily Report Generation
    # -------------------------------------------------------------------------

    def generate_daily_report(self) -> str:
        """Generate a markdown daily report."""
        today = today_str()
        et_now = now_et()

        today_actions = [
            a for a in self.action_history
            if a.get("timestamp", "").startswith(today)
        ]

        # Categorize actions
        posts_made = [
            a for a in today_actions if a.get("action") == "post_content"
        ]
        replies_sent = [
            a for a in today_actions if a.get("action") == "reply_to_post"
        ]
        scans_done = [
            a for a in today_actions if a.get("action") == "scan_reddit"
        ]
        content_generated = [
            a for a in today_actions
            if a.get("action") == "generate_fresh_content"
        ]
        analyses_done = [
            a for a in today_actions
            if a.get("action") == "analyze_engagement"
        ]

        report = f"""# ForgeCadNeo Marketing Agent - Daily Report
**Date:** {today}
**Generated:** {et_now.strftime('%Y-%m-%d %I:%M %p ET')}

## Summary
- **Total actions taken:** {len(today_actions)}
- **Posts made:** {len(posts_made)}
- **Replies sent:** {len(replies_sent)}
- **Reddit scans:** {len(scans_done)}
- **Content generated:** {len(content_generated)}
- **Engagement analyses:** {len(analyses_done)}

## Posts Made
"""
        if posts_made:
            for p in posts_made:
                report += (
                    f"- [{p.get('timestamp', '?')[11:19]}] "
                    f"{p.get('details', {}).get('title', 'Untitled')[:60]}\n"
                    f"  Status: {p.get('status', '?')}\n"
                )
        else:
            report += "No posts made today.\n"

        report += "\n## Replies Sent\n"
        if replies_sent:
            for r in replies_sent:
                details = r.get("details", {})
                report += (
                    f"- [{r.get('timestamp', '?')[11:19]}] "
                    f"r/{details.get('subreddit', '?')}: "
                    f"\"{details.get('post_title', '?')[:50]}\"\n"
                    f"  Keyword: \"{details.get('matched_keyword', '?')}\"\n"
                    f"  Status: {r.get('status', '?')}\n"
                )
        else:
            report += "No replies sent today.\n"

        report += "\n## Reddit Scan Results\n"
        unhandled = len([
            m for m in self.reddit_matches
            if not m.get("handled", False)
            and m.get("id") not in self.replied_post_ids
        ])
        report += (
            f"- Total matches in queue: {len(self.reddit_matches)}\n"
            f"- Unhandled matches: {unhandled}\n"
        )

        report += "\n## Engagement Metrics\n"
        if self.engagement_data:
            for post_id, metrics in sorted(
                self.engagement_data.items(),
                key=lambda kv: kv[1].get("updated_at", ""),
                reverse=True,
            )[:10]:
                report += (
                    f"- {post_id}: score={metrics.get('score', 0)}, "
                    f"comments={metrics.get('num_comments', 0)}\n"
                )
        else:
            report += "No engagement data tracked yet.\n"

        report += "\n## Content Queue Status\n"
        report += f"- Pending items: {len(self.pending_queue)}\n"
        report += (
            f"- Total posted (all time): {len(self.posted_content_ids)}\n"
        )

        report += "\n## Decision Log\n"
        for a in today_actions:
            ts = a.get("timestamp", "?")[11:19]
            action = a.get("action", "?")
            reason = a.get("reason", "")
            status = a.get("status", "?")
            report += f"- `{ts}` **{action}** ({status}): {reason}\n"

        report += (
            f"\n---\n*Generated by ForgeCadNeo Autonomous Marketing Agent*\n"
        )

        return report

    def save_daily_report(self):
        """Write the daily report to a file."""
        report_dir = DEFAULT_DAILY_REPORT_DIR
        report_dir.mkdir(exist_ok=True)
        report_file = report_dir / f"report-{today_str()}.md"
        report_file.write_text(self.generate_daily_report(), encoding="utf-8")
        logger.info(f"Daily report saved to {report_file}")


# =============================================================================
# CLI ENTRY POINT (for testing)
# =============================================================================

if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    state = AgentState()
    state.load()

    if "--summary" in sys.argv:
        print(state.summarize())
    elif "--status" in sys.argv:
        print(state.format_status())
    elif "--report" in sys.argv:
        print(state.generate_daily_report())
    elif "--load-content" in sys.argv:
        state.load_content_queues()
        for item in state.pending_queue[:5]:
            print(f"  [{item.get('source')}] {item.get('title', 'untitled')[:60]}")
        print(f"  ... {len(state.pending_queue)} total items")
    else:
        print("Usage: python agent-state.py [--summary|--status|--report|--load-content]")
