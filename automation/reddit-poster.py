#!/usr/bin/env python3
"""
Reddit Auto-Poster for ForgeCadNeo
====================================
Posts content from markdown queue files to Reddit using PRAW.
Supports scheduling, rate limiting, dry-run mode, and posting to
both subreddits and user profiles.

Queue files:
    - reddit-posts-draft.md       (subreddit-targeted posts)
    - reddit-profile-posts.md     (user profile posts)
    - reddit-saas-indie-posts.md  (SaaS/indie community posts)

Usage:
    python reddit-poster.py --queue reddit-profile-posts.md --dry-run
    python reddit-poster.py --queue reddit-posts-draft.md --post 1
    python reddit-poster.py --queue reddit-posts-draft.md --post 3 --subreddit cad
    python reddit-poster.py --post-all --queue reddit-profile-posts.md --dry-run
    python reddit-poster.py --list --queue reddit-posts-draft.md

Cron setup (post one item from queue daily at 9 AM):
    0 9 * * * cd /path/to/automation && python3 reddit-poster.py --queue reddit-profile-posts.md --post-next >> post.log 2>&1

Environment variables required:
    REDDIT_CLIENT_ID
    REDDIT_CLIENT_SECRET
    REDDIT_USERNAME
    REDDIT_PASSWORD
    REDDIT_USER_AGENT (optional, has default)
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# Rate limiting
MIN_POST_INTERVAL_SECONDS = 600  # Reddit's 1 post per 10 minutes rule
MAX_POSTS_PER_DAY = 5

# Log files
POST_LOG_FILE = SCRIPT_DIR / "post-log.json"

# Logging
logger = logging.getLogger("reddit-poster")


# =============================================================================
# REDDIT CLIENT
# =============================================================================

def create_reddit_client():
    """Create and return an authenticated PRAW Reddit instance."""
    try:
        import praw
    except ImportError:
        logger.error("praw not installed. Run: pip install praw")
        sys.exit(1)

    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")
    username = os.environ.get("REDDIT_USERNAME", "")
    password = os.environ.get("REDDIT_PASSWORD", "")
    user_agent = os.environ.get(
        "REDDIT_USER_AGENT",
        f"ForgeCadNeo Marketing Bot v1.0 (by /u/{username})"
    )

    if not all([client_id, client_secret, username, password]):
        logger.error(
            "Reddit credentials not configured. Set environment variables:\n"
            "  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
        )
        sys.exit(1)

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        username=username,
        password=password,
        user_agent=user_agent,
    )

    # Verify authentication
    try:
        me = reddit.user.me()
        logger.info(f"Authenticated as u/{me.name}")
    except Exception as e:
        logger.error(f"Reddit authentication failed: {e}")
        sys.exit(1)

    return reddit


# =============================================================================
# QUEUE PARSING
# =============================================================================

def parse_markdown_queue(filepath: Path) -> list[dict]:
    """
    Parse a markdown queue file into a list of post dictionaries.

    Expected format:
        ## Post N — Title/Description
        **Subreddit:** r/subreddit (optional)
        **Title:** The post title
        **Body:**
        The post body text...
        ---

    Or the simpler profile post format:
        ## Post N: Title
        **Title:** The post title
        Body text follows directly...
        ---

    Returns:
        List of dicts with keys: number, description, subreddit, title, body, flair
    """
    if not filepath.exists():
        logger.error(f"Queue file not found: {filepath}")
        return []

    content = filepath.read_text(encoding="utf-8")
    posts = []

    # Split on horizontal rules (--- on its own line)
    blocks = re.split(r"\n---+\n", content)

    for block in blocks:
        block = block.strip()
        if not block or block.startswith("#") and "\n" not in block:
            continue

        post = {}

        # Extract post number and description from heading
        heading_match = re.search(
            r"^##\s+Post\s+(\d+)\s*[:\u2014\-]*\s*(.*?)$", block, re.MULTILINE
        )
        if heading_match:
            post["number"] = int(heading_match.group(1))
            post["description"] = heading_match.group(2).strip()
        else:
            # Try any ## heading
            heading_match = re.search(r"^##\s+(.+)$", block, re.MULTILINE)
            if heading_match:
                post["description"] = heading_match.group(1).strip()
                # Try to extract a number
                num_match = re.search(r"(\d+)", post["description"])
                post["number"] = int(num_match.group(1)) if num_match else 0
            else:
                continue

        # Extract subreddit
        sub_match = re.search(
            r"\*\*Subreddit:\*\*\s*r/(\S+)", block, re.IGNORECASE
        )
        if sub_match:
            post["subreddit"] = sub_match.group(1).strip()

        # Extract flair suggestion
        flair_match = re.search(
            r"\*\*Flair[^:]*:\*\*\s*(.+)$", block, re.MULTILINE | re.IGNORECASE
        )
        if flair_match:
            post["flair"] = flair_match.group(1).strip()

        # Extract title
        title_match = re.search(
            r"\*\*Title:\*\*\s*(.+?)$", block, re.MULTILINE
        )
        if title_match:
            post["title"] = title_match.group(1).strip()
        else:
            # Use description as title fallback
            post["title"] = post.get("description", "Untitled")

        # Extract body (everything after **Body:** or after the title line)
        body_match = re.search(
            r"\*\*Body:\*\*\s*\n(.*)", block, re.DOTALL
        )
        if body_match:
            post["body"] = body_match.group(1).strip()
        else:
            # Take everything after the title line
            title_line = post.get("title", "")
            title_idx = block.find(title_line)
            if title_idx >= 0:
                after_title = block[title_idx + len(title_line):]
                # Remove leading metadata lines
                lines = after_title.split("\n")
                body_lines = []
                past_metadata = False
                for line in lines:
                    if past_metadata:
                        body_lines.append(line)
                    elif not line.strip().startswith("**") and line.strip():
                        past_metadata = True
                        body_lines.append(line)
                    elif not line.strip():
                        if past_metadata:
                            body_lines.append(line)
                post["body"] = "\n".join(body_lines).strip()
            else:
                post["body"] = ""

        if post.get("title") and (post.get("body") or post.get("description")):
            posts.append(post)

    logger.info(f"Parsed {len(posts)} posts from {filepath.name}")
    return posts


# =============================================================================
# POST TRACKING
# =============================================================================

def load_post_log() -> list[dict]:
    """Load the post history log."""
    if POST_LOG_FILE.exists():
        try:
            with open(POST_LOG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_post_log(log: list[dict]):
    """Save the post history log."""
    with open(POST_LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)


def get_posts_today(log: list[dict]) -> int:
    """Count how many posts were made today."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return sum(1 for entry in log if entry.get("posted_at", "").startswith(today))


def get_last_post_time(log: list[dict]) -> Optional[datetime]:
    """Get the timestamp of the most recent post."""
    if not log:
        return None
    try:
        last = log[-1]
        return datetime.fromisoformat(last["posted_at"])
    except (KeyError, ValueError):
        return None


def can_post(log: list[dict]) -> tuple[bool, str]:
    """
    Check if we can post right now based on rate limits.

    Returns:
        Tuple of (can_post: bool, reason: str)
    """
    # Check daily limit
    today_count = get_posts_today(log)
    if today_count >= MAX_POSTS_PER_DAY:
        return False, f"Daily limit reached ({today_count}/{MAX_POSTS_PER_DAY} posts today)"

    # Check interval since last post
    last_time = get_last_post_time(log)
    if last_time:
        elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
        if elapsed < MIN_POST_INTERVAL_SECONDS:
            remaining = int(MIN_POST_INTERVAL_SECONDS - elapsed)
            return False, f"Rate limit: must wait {remaining}s before next post"

    return True, "OK"


# =============================================================================
# POSTING FUNCTIONS
# =============================================================================

def post_to_reddit(
    reddit,
    title: str,
    body: str,
    subreddit: str,
    flair: Optional[str] = None,
    dry_run: bool = False,
) -> dict:
    """
    Post to a subreddit or user profile.

    Args:
        reddit: Authenticated PRAW Reddit instance.
        title: Post title.
        body: Post body (markdown).
        subreddit: Subreddit name (e.g., "cad") or "u_username" for profile.
        flair: Optional flair text.
        dry_run: If True, log what would be posted without actually posting.

    Returns:
        Dict with post details (url, id, subreddit, etc.)
    """
    username = os.environ.get("REDDIT_USERNAME", "")
    is_profile = subreddit.startswith("u_") or subreddit.startswith("u/")

    # Normalize profile posting target
    if is_profile:
        target_name = f"u_{username}"
    else:
        target_name = subreddit

    result = {
        "title": title,
        "subreddit": target_name,
        "posted_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
    }

    if dry_run:
        logger.info(f"[DRY RUN] Would post to r/{target_name}:")
        logger.info(f"  Title: {title}")
        logger.info(f"  Body: {body[:200]}...")
        if flair:
            logger.info(f"  Flair: {flair}")
        result["status"] = "dry_run"
        result["url"] = f"https://www.reddit.com/r/{target_name}/dry-run"
        return result

    try:
        sub = reddit.subreddit(target_name)

        # Submit the post
        submission = sub.submit(title=title, selftext=body)

        # Try to set flair if provided
        if flair:
            try:
                choices = submission.flair.choices()
                matching = [c for c in choices if flair.lower() in c["flair_text"].lower()]
                if matching:
                    submission.flair.select(matching[0]["flair_template_id"])
                    logger.info(f"  Flair set: {matching[0]['flair_text']}")
            except Exception as e:
                logger.warning(f"  Could not set flair: {e}")

        result["status"] = "posted"
        result["url"] = f"https://www.reddit.com{submission.permalink}"
        result["id"] = submission.id

        logger.info(f"[POSTED] r/{target_name}: {title}")
        logger.info(f"  URL: {result['url']}")

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error(f"[ERROR] Failed to post to r/{target_name}: {e}")

    return result


def post_from_queue(
    reddit,
    queue_file: Path,
    post_number: Optional[int] = None,
    subreddit_override: Optional[str] = None,
    dry_run: bool = False,
    post_next: bool = False,
    post_all: bool = False,
) -> list[dict]:
    """
    Post one or more items from a markdown queue file.

    Args:
        reddit: Authenticated PRAW Reddit instance (or None for dry-run).
        queue_file: Path to the markdown queue file.
        post_number: Specific post number to submit.
        subreddit_override: Override the subreddit from the queue file.
        dry_run: If True, show what would be posted without posting.
        post_next: Post the next unposted item.
        post_all: Post all items (with rate limiting).

    Returns:
        List of result dicts from each post attempt.
    """
    posts = parse_markdown_queue(queue_file)
    if not posts:
        logger.warning(f"No posts found in {queue_file}")
        return []

    post_log = load_post_log()
    posted_titles = {entry.get("title", "") for entry in post_log if entry.get("status") == "posted"}
    results = []

    # Determine which posts to submit
    if post_number is not None:
        targets = [p for p in posts if p.get("number") == post_number]
        if not targets:
            logger.error(f"Post #{post_number} not found in queue. Available: {[p.get('number') for p in posts]}")
            return []
    elif post_next:
        targets = [p for p in posts if p.get("title", "") not in posted_titles]
        if targets:
            targets = [targets[0]]  # Just the next one
        else:
            logger.info("All posts in queue have been posted.")
            return []
    elif post_all:
        targets = [p for p in posts if p.get("title", "") not in posted_titles]
        if not targets:
            logger.info("All posts in queue have been posted.")
            return []
    else:
        targets = posts[:1]  # Default: first post

    logger.info(f"Preparing to post {len(targets)} item(s) from {queue_file.name}")

    for i, post in enumerate(targets):
        # Check rate limits
        if not dry_run:
            ok, reason = can_post(post_log)
            if not ok:
                logger.warning(f"[SKIP] {reason}")
                if not post_all:
                    break
                # For post_all, wait and retry
                wait_time = MIN_POST_INTERVAL_SECONDS + 10
                logger.info(f"Waiting {wait_time}s before next post...")
                time.sleep(wait_time)

        # Determine subreddit
        subreddit = subreddit_override or post.get("subreddit", "")
        if not subreddit:
            # Default to user profile
            username = os.environ.get("REDDIT_USERNAME", "")
            subreddit = f"u_{username}" if username else "test"

        title = post.get("title", "Untitled")
        body = post.get("body", "")
        flair = post.get("flair")

        print(f"\n{'=' * 60}")
        print(f"Post {post.get('number', '?')}: {post.get('description', '')}")
        print(f"  Target: r/{subreddit}")
        print(f"  Title:  {title}")
        print(f"  Body:   {len(body)} chars")
        print(f"{'=' * 60}")

        result = post_to_reddit(
            reddit, title, body, subreddit, flair=flair, dry_run=dry_run
        )
        result["queue_file"] = queue_file.name
        result["post_number"] = post.get("number")
        results.append(result)

        # Update log
        if not dry_run:
            post_log.append(result)
            save_post_log(post_log)

        # Rate limit pause between posts
        if i < len(targets) - 1 and not dry_run:
            logger.info(f"Waiting {MIN_POST_INTERVAL_SECONDS}s before next post (Reddit rate limit)...")
            time.sleep(MIN_POST_INTERVAL_SECONDS)

    return results


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Reddit Auto-Poster for ForgeCadNeo marketing content",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all posts in a queue file
  python reddit-poster.py --list --queue reddit-profile-posts.md

  # Dry-run: see what would be posted
  python reddit-poster.py --queue reddit-posts-draft.md --post 1 --dry-run

  # Post a specific item from the queue
  python reddit-poster.py --queue reddit-posts-draft.md --post 3

  # Post with subreddit override
  python reddit-poster.py --queue reddit-posts-draft.md --post 1 --subreddit cad

  # Post the next unposted item
  python reddit-poster.py --queue reddit-profile-posts.md --post-next

  # Post all unposted items (with rate limiting)
  python reddit-poster.py --queue reddit-profile-posts.md --post-all --dry-run

  # Post to user profile
  python reddit-poster.py --queue reddit-profile-posts.md --post 1 --subreddit u_YourUsername
        """,
    )
    parser.add_argument(
        "--queue",
        type=str,
        default="",
        help="Path to the markdown queue file (relative to automation/ or absolute)",
    )
    parser.add_argument(
        "--post",
        type=int,
        metavar="N",
        help="Post a specific item by number from the queue",
    )
    parser.add_argument(
        "--post-next",
        action="store_true",
        help="Post the next unposted item from the queue",
    )
    parser.add_argument(
        "--post-all",
        action="store_true",
        help="Post all unposted items (with rate limiting between posts)",
    )
    parser.add_argument(
        "--subreddit",
        type=str,
        help="Override the target subreddit (e.g., 'cad' or 'u_username')",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all posts in the queue without posting",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be posted without actually posting",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show posting history and rate limit status",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Resolve queue file path
    queue_path = Path(args.queue)
    if not queue_path.is_absolute():
        queue_path = SCRIPT_DIR / queue_path

    # Status command
    if args.status:
        log = load_post_log()
        today_count = get_posts_today(log)
        last_time = get_last_post_time(log)
        ok, reason = can_post(log)

        print(f"\nReddit Poster Status")
        print(f"{'=' * 40}")
        print(f"Total posts:     {len(log)}")
        print(f"Posts today:     {today_count}/{MAX_POSTS_PER_DAY}")
        print(f"Last post:       {last_time.isoformat() if last_time else 'Never'}")
        print(f"Can post now:    {'Yes' if ok else f'No ({reason})'}")
        print()

        if log:
            print("Recent posts:")
            for entry in log[-5:]:
                status = entry.get("status", "unknown")
                title = entry.get("title", "?")[:50]
                sub = entry.get("subreddit", "?")
                ts = entry.get("posted_at", "?")[:19]
                print(f"  [{status}] {ts} r/{sub}: {title}")
        print()
        return

    # Require --queue for all non-status commands
    if not args.queue:
        print("Error: --queue is required. Example: --queue reddit-profile-posts.md")
        sys.exit(1)

    # List command
    if args.list:
        posts = parse_markdown_queue(queue_path)
        log = load_post_log()
        posted_titles = {e.get("title", "") for e in log if e.get("status") == "posted"}

        print(f"\nQueue: {queue_path.name}")
        print(f"{'=' * 60}")
        for post in posts:
            num = post.get("number", "?")
            title = post.get("title", "Untitled")
            sub = post.get("subreddit", "profile")
            posted = "POSTED" if title in posted_titles else "PENDING"
            print(f"  [{posted}] #{num} — r/{sub}: {title[:60]}")
        print(f"\nTotal: {len(posts)} posts")
        print()
        return

    # Posting commands
    if not args.dry_run:
        reddit = create_reddit_client()
    else:
        reddit = None

    results = post_from_queue(
        reddit=reddit,
        queue_file=queue_path,
        post_number=args.post,
        subreddit_override=args.subreddit,
        dry_run=args.dry_run,
        post_next=args.post_next,
        post_all=args.post_all,
    )

    # Summary
    if results:
        print(f"\n{'=' * 60}")
        print(f"Results Summary")
        print(f"{'=' * 60}")
        for r in results:
            status = r.get("status", "unknown")
            title = r.get("title", "?")[:50]
            url = r.get("url", "N/A")
            print(f"  [{status.upper()}] {title}")
            if url != "N/A":
                print(f"    URL: {url}")
        print()


if __name__ == "__main__":
    main()
