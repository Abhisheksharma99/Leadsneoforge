#!/usr/bin/env python3
"""
Automation Runner for ForgeCadNeo
===================================
Master orchestrator that runs all marketing automation tasks in sequence
or in parallel. Supports daily routines, weekly routines, and individual
task execution.

Daily routine:
    1. Scan Reddit for keyword matches (monitor-reddit.py)
    2. Generate and post replies to matching posts (reddit-reply-bot.py)
    3. Post scheduled content from the calendar (content-scheduler.py)
    4. Track daily metrics (track-metrics.sh)
    5. Log summary

Weekly routine:
    1. Run full daily routine
    2. Analyze engagement on recent posts
    3. Generate content ideas for next week
    4. Update keyword lists based on what's working
    5. Generate weekly summary report

Usage:
    python run-automation.py --daily
    python run-automation.py --daily --dry-run
    python run-automation.py --weekly
    python run-automation.py --task reddit-scan
    python run-automation.py --task reddit-reply --dry-run
    python run-automation.py --task post-content --dry-run
    python run-automation.py --task metrics
    python run-automation.py --status
    python run-automation.py --list-tasks

Cron setup:
    # Daily at 9 AM
    0 9 * * * cd /path/to/automation && python3 run-automation.py --daily >> automation.log 2>&1

    # Weekly on Monday at 8 AM
    0 8 * * 1 cd /path/to/automation && python3 run-automation.py --weekly >> automation.log 2>&1

Environment variables:
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
    ANTHROPIC_API_KEY
    LINKEDIN_ACCESS_TOKEN (optional)
    TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET (optional)
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# Automation log
LOG_FILE = SCRIPT_DIR / "automation.log"
RUN_HISTORY_FILE = SCRIPT_DIR / "run-history.json"

# Logger
logger = logging.getLogger("automation-runner")


# =============================================================================
# LOGGING SETUP
# =============================================================================

def setup_logging(verbose: bool = False):
    """Configure logging with both file and console handlers."""
    log_level = logging.DEBUG if verbose else logging.INFO

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(log_level)
    console.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    ))
    root_logger.addHandler(console)

    # File handler (rotating, 10 MB max, 5 backups)
    try:
        file_handler = RotatingFileHandler(
            LOG_FILE,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))
        root_logger.addHandler(file_handler)
    except Exception as e:
        logger.warning(f"Could not set up file logging: {e}")


# =============================================================================
# RUN HISTORY
# =============================================================================

def load_run_history() -> list[dict]:
    """Load run history."""
    if RUN_HISTORY_FILE.exists():
        try:
            with open(RUN_HISTORY_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_run_history(history: list[dict]):
    """Save run history (keep last 100 entries)."""
    with open(RUN_HISTORY_FILE, "w") as f:
        json.dump(history[-100:], f, indent=2)


def record_run(task: str, status: str, details: Optional[dict] = None):
    """Record a task execution in the run history."""
    history = load_run_history()
    entry = {
        "task": task,
        "status": status,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "details": details or {},
    }
    history.append(entry)
    save_run_history(history)


# =============================================================================
# TASK DEFINITIONS
# =============================================================================

def run_task_reddit_scan(dry_run: bool = False) -> dict:
    """
    Task: Scan Reddit for keyword matches.
    Executes monitor-reddit.py.
    """
    logger.info("=" * 50)
    logger.info("TASK: Reddit Keyword Scan")
    logger.info("=" * 50)

    script = SCRIPT_DIR / "monitor-reddit.py"
    if not script.exists():
        logger.error(f"Script not found: {script}")
        return {"status": "error", "error": "monitor-reddit.py not found"}

    cmd = [sys.executable, str(script)]
    if not dry_run:
        cmd.append("--notify")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd=str(SCRIPT_DIR),
        )
        logger.info(f"Reddit scan completed (exit code: {result.returncode})")

        # Count matches from output
        match_count = 0
        for line in result.stdout.split("\n"):
            if "[MATCH]" in line:
                match_count += 1
            if line.strip():
                logger.debug(f"  {line.strip()}")

        return {
            "status": "success" if result.returncode in (0, 1) else "error",
            "matches_found": match_count,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.error("Reddit scan timed out after 5 minutes")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"Reddit scan failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_reddit_reply(dry_run: bool = False, limit: int = 3) -> dict:
    """
    Task: Generate and post replies to matched Reddit posts.
    Executes reddit-reply-bot.py.
    """
    logger.info("=" * 50)
    logger.info("TASK: Reddit Reply Generation")
    logger.info("=" * 50)

    script = SCRIPT_DIR / "reddit-reply-bot.py"
    if not script.exists():
        logger.error(f"Script not found: {script}")
        return {"status": "error", "error": "reddit-reply-bot.py not found"}

    cmd = [sys.executable, str(script), "--once", "--limit", str(limit)]
    if dry_run:
        cmd.append("--dry-run")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=str(SCRIPT_DIR),
        )
        logger.info(f"Reply bot completed (exit code: {result.returncode})")

        # Parse reply count from output
        replies = 0
        for line in result.stdout.split("\n"):
            if "Replies posted:" in line:
                try:
                    replies = int(line.split(":")[-1].strip())
                except ValueError:
                    pass
            if line.strip():
                logger.debug(f"  {line.strip()}")

        return {
            "status": "success",
            "replies_posted": replies,
            "dry_run": dry_run,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.error("Reply bot timed out after 10 minutes")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"Reply bot failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_post_content(
    dry_run: bool = False,
    platform: str = "all",
    day: Optional[int] = None,
) -> dict:
    """
    Task: Post scheduled content from the content calendar.
    Executes content-scheduler.py.
    """
    logger.info("=" * 50)
    logger.info("TASK: Content Posting")
    logger.info("=" * 50)

    script = SCRIPT_DIR / "content-scheduler.py"
    if not script.exists():
        logger.error(f"Script not found: {script}")
        return {"status": "error", "error": "content-scheduler.py not found"}

    cmd = [sys.executable, str(script)]
    if day is not None:
        cmd.extend(["--day", str(day)])
    else:
        cmd.append("--today")

    cmd.extend(["--platform", platform])

    if dry_run:
        cmd.append("--dry-run")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=str(SCRIPT_DIR),
        )
        logger.info(f"Content scheduler completed (exit code: {result.returncode})")

        for line in result.stdout.split("\n"):
            if line.strip():
                logger.debug(f"  {line.strip()}")

        return {
            "status": "success",
            "dry_run": dry_run,
            "platform": platform,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.error("Content scheduler timed out after 10 minutes")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"Content scheduler failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_reddit_post(
    dry_run: bool = False,
    queue: str = "reddit-profile-posts.md",
) -> dict:
    """
    Task: Post the next item from a Reddit queue file.
    Executes reddit-poster.py.
    """
    logger.info("=" * 50)
    logger.info(f"TASK: Reddit Post (queue: {queue})")
    logger.info("=" * 50)

    script = SCRIPT_DIR / "reddit-poster.py"
    if not script.exists():
        logger.error(f"Script not found: {script}")
        return {"status": "error", "error": "reddit-poster.py not found"}

    cmd = [sys.executable, str(script), "--queue", queue, "--post-next"]
    if dry_run:
        cmd.append("--dry-run")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(SCRIPT_DIR),
        )
        logger.info(f"Reddit poster completed (exit code: {result.returncode})")

        for line in result.stdout.split("\n"):
            if line.strip():
                logger.debug(f"  {line.strip()}")

        return {
            "status": "success",
            "dry_run": dry_run,
            "queue": queue,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.error("Reddit poster timed out")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"Reddit poster failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_metrics() -> dict:
    """
    Task: Track daily metrics.
    Executes track-metrics.sh.
    """
    logger.info("=" * 50)
    logger.info("TASK: Daily Metrics Collection")
    logger.info("=" * 50)

    script = SCRIPT_DIR / "track-metrics.sh"
    if not script.exists():
        logger.error(f"Script not found: {script}")
        return {"status": "error", "error": "track-metrics.sh not found"}

    try:
        result = subprocess.run(
            ["bash", str(script)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(SCRIPT_DIR),
        )
        logger.info(f"Metrics collection completed (exit code: {result.returncode})")

        for line in result.stdout.split("\n"):
            if line.strip():
                logger.debug(f"  {line.strip()}")

        return {
            "status": "success" if result.returncode == 0 else "error",
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        logger.error("Metrics collection timed out")
        return {"status": "timeout"}
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_analyze_engagement(dry_run: bool = False) -> dict:
    """
    Task: Analyze engagement on recent posts using Claude.
    Reads from reply-log.json and post-log.json.
    """
    logger.info("=" * 50)
    logger.info("TASK: Engagement Analysis")
    logger.info("=" * 50)

    try:
        sys.path.insert(0, str(SCRIPT_DIR))
        from claude_bot import ClaudeBot
        bot = ClaudeBot()
    except Exception as e:
        logger.error(f"Could not initialize Claude bot: {e}")
        return {"status": "error", "error": str(e)}

    # Gather recent post data
    post_log_file = SCRIPT_DIR / "post-log.json"
    reply_log_file = SCRIPT_DIR / "reply-log.json"
    matches_file = SCRIPT_DIR / "reddit-matches.json"

    summary_parts = []

    if post_log_file.exists():
        try:
            with open(post_log_file, "r") as f:
                posts = json.load(f)
            summary_parts.append(f"Posts made: {len(posts)}")
            for p in posts[-5:]:
                summary_parts.append(
                    f"  - [{p.get('status')}] {p.get('subreddit', '?')}: "
                    f"{p.get('title', '?')[:60]}"
                )
        except Exception:
            pass

    if reply_log_file.exists():
        try:
            with open(reply_log_file, "r") as f:
                replies = json.load(f)
            summary_parts.append(f"Replies made: {len(replies)}")
            for r in replies[-5:]:
                summary_parts.append(
                    f"  - [{r.get('status')}] r/{r.get('subreddit', '?')}: "
                    f"{r.get('post_title', '?')[:60]}"
                )
        except Exception:
            pass

    if matches_file.exists():
        try:
            with open(matches_file, "r") as f:
                matches = json.load(f)
            summary_parts.append(f"Total keyword matches tracked: {len(matches)}")

            # Keyword frequency
            keyword_counts = {}
            for m in matches:
                kw = m.get("matched_keyword", "unknown")
                keyword_counts[kw] = keyword_counts.get(kw, 0) + 1

            top_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            summary_parts.append("Top keywords:")
            for kw, count in top_keywords:
                summary_parts.append(f"  - \"{kw}\": {count} matches")
        except Exception:
            pass

    if not summary_parts:
        logger.info("No post or reply data available for analysis")
        return {"status": "skipped", "reason": "no data"}

    summary = "\n".join(summary_parts)

    if dry_run:
        logger.info(f"[DRY RUN] Would analyze:\n{summary}")
        return {"status": "dry_run", "summary": summary}

    # Ask Claude for analysis
    try:
        analysis = bot.analyze_post_engagement(
            summary,
            metrics={"data_period": "last_7_days"},
        )
        logger.info(f"Engagement analysis:\n{analysis}")

        # Save analysis
        analysis_file = SCRIPT_DIR / "weekly-analysis.md"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        with open(analysis_file, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n## Analysis: {timestamp}\n\n{analysis}\n")

        return {"status": "success", "analysis_length": len(analysis)}
    except Exception as e:
        logger.error(f"Engagement analysis failed: {e}")
        return {"status": "error", "error": str(e)}


def run_task_content_ideas(platform: str = "reddit", count: int = 5) -> dict:
    """
    Task: Generate content ideas for the next week using Claude.
    """
    logger.info("=" * 50)
    logger.info(f"TASK: Content Ideas ({platform}, {count} ideas)")
    logger.info("=" * 50)

    try:
        sys.path.insert(0, str(SCRIPT_DIR))
        from claude_bot import ClaudeBot
        bot = ClaudeBot()
    except Exception as e:
        logger.error(f"Could not initialize Claude bot: {e}")
        return {"status": "error", "error": str(e)}

    try:
        ideas = bot.generate_content_ideas(platform, count)
        logger.info(f"Generated content ideas:\n{ideas}")

        # Save ideas
        ideas_file = SCRIPT_DIR / "content-ideas.md"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        with open(ideas_file, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n## Ideas for {platform}: {timestamp}\n\n{ideas}\n")

        return {"status": "success", "ideas_count": count}
    except Exception as e:
        logger.error(f"Content ideas generation failed: {e}")
        return {"status": "error", "error": str(e)}


# =============================================================================
# ROUTINES
# =============================================================================

def run_daily(dry_run: bool = False) -> dict:
    """
    Execute the daily automation routine.

    Sequence:
        1. Scan Reddit for keyword matches
        2. Generate and post replies
        3. Post scheduled content
        4. Post next item from Reddit profile queue
        5. Collect daily metrics
    """
    start_time = time.time()

    print(f"\n{'#' * 60}")
    print(f"# ForgeCadNeo Daily Automation")
    print(f"# {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"# Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'#' * 60}\n")

    results = {}

    # Step 1: Reddit scan
    try:
        results["reddit_scan"] = run_task_reddit_scan(dry_run)
    except Exception as e:
        logger.error(f"Reddit scan task failed: {e}")
        results["reddit_scan"] = {"status": "error", "error": str(e)}

    # Step 2: Reddit replies
    try:
        results["reddit_reply"] = run_task_reddit_reply(dry_run, limit=3)
    except Exception as e:
        logger.error(f"Reddit reply task failed: {e}")
        results["reddit_reply"] = {"status": "error", "error": str(e)}

    # Step 3: Scheduled content
    try:
        results["post_content"] = run_task_post_content(dry_run)
    except Exception as e:
        logger.error(f"Content posting task failed: {e}")
        results["post_content"] = {"status": "error", "error": str(e)}

    # Step 4: Reddit profile post
    try:
        results["reddit_post"] = run_task_reddit_post(dry_run)
    except Exception as e:
        logger.error(f"Reddit post task failed: {e}")
        results["reddit_post"] = {"status": "error", "error": str(e)}

    # Step 5: Metrics (always runs, not affected by dry-run)
    try:
        results["metrics"] = run_task_metrics()
    except Exception as e:
        logger.error(f"Metrics task failed: {e}")
        results["metrics"] = {"status": "error", "error": str(e)}

    elapsed = time.time() - start_time

    # Summary
    print(f"\n{'#' * 60}")
    print(f"# Daily Routine Complete")
    print(f"# Duration: {elapsed:.1f}s")
    print(f"{'#' * 60}")

    for task_name, task_result in results.items():
        status = task_result.get("status", "unknown")
        icon = "OK" if status == "success" else status.upper()
        print(f"  [{icon:10s}] {task_name}")

    print()

    record_run("daily", "completed", {
        "dry_run": dry_run,
        "duration_seconds": round(elapsed, 1),
        "results": {k: v.get("status") for k, v in results.items()},
    })

    return results


def run_weekly(dry_run: bool = False) -> dict:
    """
    Execute the weekly automation routine.

    Sequence:
        1. Run full daily routine
        2. Analyze engagement
        3. Generate content ideas
        4. Summary report
    """
    start_time = time.time()

    print(f"\n{'#' * 60}")
    print(f"# ForgeCadNeo Weekly Automation")
    print(f"# {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"# Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'#' * 60}\n")

    results = {}

    # Step 1: Run daily routine
    results["daily"] = run_daily(dry_run)

    # Step 2: Analyze engagement
    try:
        results["engagement_analysis"] = run_task_analyze_engagement(dry_run)
    except Exception as e:
        logger.error(f"Engagement analysis failed: {e}")
        results["engagement_analysis"] = {"status": "error", "error": str(e)}

    # Step 3: Generate content ideas
    try:
        results["content_ideas_reddit"] = run_task_content_ideas("reddit", 10)
        results["content_ideas_linkedin"] = run_task_content_ideas("linkedin", 5)
    except Exception as e:
        logger.error(f"Content ideas generation failed: {e}")
        results["content_ideas"] = {"status": "error", "error": str(e)}

    elapsed = time.time() - start_time

    # Summary
    print(f"\n{'#' * 60}")
    print(f"# Weekly Routine Complete")
    print(f"# Duration: {elapsed:.1f}s")
    print(f"{'#' * 60}")

    for task_name, task_result in results.items():
        if isinstance(task_result, dict) and "status" in task_result:
            status = task_result.get("status", "unknown")
        else:
            status = "compound"
        icon = "OK" if status in ("success", "compound", "completed") else status.upper()
        print(f"  [{icon:10s}] {task_name}")

    print()

    record_run("weekly", "completed", {
        "dry_run": dry_run,
        "duration_seconds": round(elapsed, 1),
    })

    return results


# =============================================================================
# AVAILABLE TASKS
# =============================================================================

TASKS = {
    "reddit-scan": {
        "func": run_task_reddit_scan,
        "description": "Scan Reddit subreddits for keyword matches",
    },
    "reddit-reply": {
        "func": run_task_reddit_reply,
        "description": "Generate and post replies to matching Reddit posts",
    },
    "reddit-post": {
        "func": run_task_reddit_post,
        "description": "Post the next item from a Reddit queue file",
    },
    "post-content": {
        "func": run_task_post_content,
        "description": "Post scheduled content from the 30-day calendar",
    },
    "metrics": {
        "func": run_task_metrics,
        "description": "Collect daily metrics (Reddit karma, website status)",
    },
    "analyze": {
        "func": run_task_analyze_engagement,
        "description": "Analyze engagement on recent posts using Claude",
    },
    "ideas": {
        "func": run_task_content_ideas,
        "description": "Generate content ideas using Claude",
    },
}


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="ForgeCadNeo Automation Runner — orchestrates all marketing automation tasks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run daily routine (dry-run)
  python run-automation.py --daily --dry-run

  # Run daily routine (live)
  python run-automation.py --daily

  # Run weekly routine
  python run-automation.py --weekly

  # Run a specific task
  python run-automation.py --task reddit-scan
  python run-automation.py --task reddit-reply --dry-run
  python run-automation.py --task post-content --dry-run

  # List available tasks
  python run-automation.py --list-tasks

  # Show run history
  python run-automation.py --status
        """,
    )
    parser.add_argument(
        "--daily",
        action="store_true",
        help="Run the daily automation routine",
    )
    parser.add_argument(
        "--weekly",
        action="store_true",
        help="Run the weekly automation routine",
    )
    parser.add_argument(
        "--task",
        type=str,
        choices=list(TASKS.keys()),
        help="Run a specific task",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without making changes",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose/debug logging",
    )
    parser.add_argument(
        "--list-tasks",
        action="store_true",
        help="List all available tasks",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show run history and status",
    )

    args = parser.parse_args()

    # Set up logging
    setup_logging(args.verbose)

    # List tasks
    if args.list_tasks:
        print(f"\nAvailable Tasks")
        print(f"{'=' * 50}")
        for name, info in TASKS.items():
            print(f"  {name:20s} {info['description']}")
        print()
        print("Routines:")
        print(f"  {'--daily':20s} Run all daily tasks in sequence")
        print(f"  {'--weekly':20s} Run daily routine + analysis + idea generation")
        print()
        return

    # Status
    if args.status:
        history = load_run_history()
        print(f"\nAutomation Runner Status")
        print(f"{'=' * 50}")
        print(f"Run history entries: {len(history)}")
        print()

        if history:
            print("Recent runs:")
            for entry in history[-10:]:
                task = entry.get("task", "?")
                status = entry.get("status", "?")
                started = entry.get("started_at", "?")[:19]
                details = entry.get("details", {})
                dry = " (dry-run)" if details.get("dry_run") else ""
                duration = details.get("duration_seconds", "")
                dur_str = f" ({duration}s)" if duration else ""
                print(f"  [{status:10s}] {started} {task}{dry}{dur_str}")
        print()
        return

    # Execute commands
    if args.daily:
        run_daily(args.dry_run)
    elif args.weekly:
        run_weekly(args.dry_run)
    elif args.task:
        task_info = TASKS[args.task]
        func = task_info["func"]

        # Pass dry_run if the function accepts it
        import inspect
        sig = inspect.signature(func)
        if "dry_run" in sig.parameters:
            result = func(dry_run=args.dry_run)
        else:
            result = func()

        record_run(args.task, result.get("status", "unknown"), {
            "dry_run": args.dry_run,
            **result,
        })
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
