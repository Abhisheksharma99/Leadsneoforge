#!/usr/bin/env python3
"""
Content Repurposing Helper for ForgeCadNeo
=============================================
Takes a long-form blog post or article and converts it into
platform-specific formats for Twitter, LinkedIn, Reddit, and email.

No AI API required — uses text processing and smart formatting.

Usage:
    python3 repurpose-content.py input-article.md
    python3 repurpose-content.py input-article.md --output-dir ./output
    python3 repurpose-content.py input-article.md --platform twitter
    echo "Your content here" | python3 repurpose-content.py --stdin

Output:
    Creates separate files for each platform format.
"""

import argparse
import os
import re
import sys
import textwrap
from datetime import datetime
from pathlib import Path

# =============================================================================
# CONFIGURATION
# =============================================================================

TWITTER_CHAR_LIMIT = 280
LINKEDIN_CHAR_LIMIT = 1300
TWITTER_THREAD_NUMBERING = True  # Add "1/N" to thread tweets

BRAND_HASHTAGS = "#ForgeCadNeo #CAD #Engineering"
TWITTER_HASHTAGS = "#CAD #Engineering #STEP #Manufacturing"
LINKEDIN_HASHTAGS = "#CAD #Engineering #MechanicalEngineering #Manufacturing #AI"

CTA_LINES = {
    "twitter": "Try ForgeCadNeo free -> forgecadneo.com",
    "linkedin": "Learn more at forgecadneo.com — free credits for early users.",
    "reddit": "",
    "email": "Get started free at forgecadneo.com",
}

# =============================================================================
# TEXT PROCESSING UTILITIES
# =============================================================================

def clean_markdown(text: str) -> str:
    """Remove markdown formatting, keeping plain text."""
    # Remove headers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic markers
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    # Remove inline code
    text = re.sub(r"`(.+?)`", r"\1", text)
    # Remove links but keep text
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    # Remove images
    text = re.sub(r"!\[.*?\]\(.+?\)", "", text)
    # Remove horizontal rules
    text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)
    # Remove blockquotes
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    # Clean up extra whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_title(text: str) -> str:
    """Extract the first heading as the title."""
    match = re.search(r"^#{1,3}\s+(.+)$", text, re.MULTILINE)
    if match:
        return match.group(1).strip()
    # Fall back to first non-empty line
    for line in text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:100]
    return "Untitled"


def extract_key_points(text: str) -> list:
    """Extract bullet points and key sentences from the text."""
    points = []

    # Extract bullet points
    for match in re.finditer(r"^[-*]\s+(.+)$", text, re.MULTILINE):
        point = match.group(1).strip()
        if len(point) > 20:
            points.append(point)

    # Extract numbered list items
    for match in re.finditer(r"^\d+[.)]\s+(.+)$", text, re.MULTILINE):
        point = match.group(1).strip()
        if len(point) > 20:
            points.append(point)

    # If not enough bullet points, extract sentences that contain key phrases
    if len(points) < 3:
        key_phrases = [
            "important", "key", "critical", "essential", "benefit",
            "advantage", "result", "achieve", "solve", "improve",
            "reduce", "increase", "save", "automate", "transform",
        ]
        sentences = re.split(r"[.!?]+", clean_markdown(text))
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 30 and any(p in sentence.lower() for p in key_phrases):
                points.append(sentence)

    return points[:10]  # Cap at 10 key points


def split_into_paragraphs(text: str) -> list:
    """Split text into meaningful paragraphs."""
    cleaned = clean_markdown(text)
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    # Filter out very short paragraphs
    return [p for p in paragraphs if len(p) > 30]


def smart_truncate(text: str, max_length: int, suffix: str = "...") -> str:
    """Truncate text at a word boundary."""
    if len(text) <= max_length:
        return text
    truncated = text[:max_length - len(suffix)]
    # Cut at last space
    last_space = truncated.rfind(" ")
    if last_space > max_length * 0.5:
        truncated = truncated[:last_space]
    return truncated + suffix


# =============================================================================
# PLATFORM FORMATTERS
# =============================================================================

def format_twitter_thread(text: str) -> list:
    """
    Convert long-form content into a Twitter thread.
    Each tweet stays within 280 characters.
    Returns a list of tweet strings.
    """
    title = extract_title(text)
    paragraphs = split_into_paragraphs(text)
    key_points = extract_key_points(text)

    tweets = []

    # Tweet 1: Hook — the title or opening statement
    hook = paragraphs[0] if paragraphs else title
    if len(hook) > 250:
        hook = smart_truncate(hook, 245)
    tweets.append(hook)

    # Middle tweets: key points and paragraphs
    used_content = set()
    for point in key_points:
        if point in used_content:
            continue
        used_content.add(point)

        tweet = smart_truncate(point, 275)
        tweets.append(tweet)

    # Fill with paragraph content if needed
    for para in paragraphs[1:]:
        if len(tweets) >= 12:  # Cap thread length
            break
        if para in used_content:
            continue

        # Split long paragraphs into tweet-sized chunks
        if len(para) <= 275:
            tweets.append(para)
        else:
            sentences = re.split(r"(?<=[.!?])\s+", para)
            current_chunk = ""
            for sentence in sentences:
                if len(current_chunk) + len(sentence) + 1 <= 275:
                    current_chunk = (current_chunk + " " + sentence).strip()
                else:
                    if current_chunk:
                        tweets.append(current_chunk)
                    current_chunk = smart_truncate(sentence, 275)
            if current_chunk:
                tweets.append(current_chunk)

    # Final tweet: CTA
    cta = CTA_LINES["twitter"]
    if cta:
        final_tweet = f"{cta}\n\n{TWITTER_HASHTAGS}"
        if len(final_tweet) <= 280:
            tweets.append(final_tweet)

    # Add thread numbering
    if TWITTER_THREAD_NUMBERING and len(tweets) > 1:
        total = len(tweets)
        numbered = []
        for i, tweet in enumerate(tweets, 1):
            numbering = f"{i}/{total}"
            available = 280 - len(numbering) - 2  # 2 for space/newline
            truncated = smart_truncate(tweet, available)
            numbered.append(f"{truncated}\n\n{numbering}")
        tweets = numbered

    # Final validation: ensure nothing exceeds 280
    validated = []
    for tweet in tweets:
        if len(tweet) > 280:
            tweet = smart_truncate(tweet, 276) + "\n\n..."
        validated.append(tweet)

    return validated


def format_linkedin_post(text: str) -> str:
    """
    Convert long-form content into a LinkedIn post (max 1300 chars).
    Uses LinkedIn best practices: hook, value, CTA.
    """
    title = extract_title(text)
    paragraphs = split_into_paragraphs(text)
    key_points = extract_key_points(text)

    parts = []

    # Hook (first 1-2 lines should grab attention)
    if paragraphs:
        hook = paragraphs[0]
        if len(hook) > 200:
            hook = smart_truncate(hook, 195)
        parts.append(hook)
    else:
        parts.append(title)

    parts.append("")  # Empty line for readability

    # Key points as a mini-list
    if key_points:
        points_text = []
        for point in key_points[:5]:
            bullet = f"- {smart_truncate(point, 150)}"
            points_text.append(bullet)
        parts.append("\n".join(points_text))
        parts.append("")

    # Supporting paragraph (if space allows)
    if len(paragraphs) > 1:
        support = smart_truncate(paragraphs[1], 200)
        parts.append(support)
        parts.append("")

    # CTA
    cta = CTA_LINES["linkedin"]
    if cta:
        parts.append(cta)
        parts.append("")

    # Hashtags
    parts.append(LINKEDIN_HASHTAGS)

    # Assemble and truncate to limit
    post = "\n".join(parts)
    if len(post) > LINKEDIN_CHAR_LIMIT:
        # Progressively remove content from the middle
        while len(post) > LINKEDIN_CHAR_LIMIT and len(parts) > 3:
            # Remove the item before CTA/hashtags
            parts.pop(-3)
            post = "\n".join(parts)

        if len(post) > LINKEDIN_CHAR_LIMIT:
            post = smart_truncate(post, LINKEDIN_CHAR_LIMIT - 50) + f"\n\n{LINKEDIN_HASHTAGS}"

    return post


def format_reddit_post(text: str) -> str:
    """
    Convert content into a Reddit-formatted post (markdown).
    Reddit loves: clear titles, formatting, TL;DR, and genuine value.
    """
    title = extract_title(text)
    paragraphs = split_into_paragraphs(text)
    key_points = extract_key_points(text)

    parts = []

    # Opening paragraph
    if paragraphs:
        parts.append(paragraphs[0])
        parts.append("")

    # Key points as a formatted list
    if key_points:
        parts.append("**Key takeaways:**")
        parts.append("")
        for point in key_points[:7]:
            parts.append(f"- {point}")
        parts.append("")

    # Body content (2-3 paragraphs)
    for para in paragraphs[1:4]:
        parts.append(para)
        parts.append("")

    # TL;DR
    if paragraphs:
        tldr_source = paragraphs[-1] if len(paragraphs) > 1 else paragraphs[0]
        tldr = smart_truncate(clean_markdown(tldr_source), 200)
        parts.append(f"**TL;DR:** {tldr}")
        parts.append("")

    # Engagement question (Reddit loves these)
    parts.append("---")
    parts.append("")
    parts.append("What's your experience with this? Would love to hear different perspectives.")

    body = "\n".join(parts)

    return f"**Title:** {title}\n\n---\n\n{body}"


def format_email_newsletter(text: str) -> str:
    """
    Convert content into an email newsletter snippet.
    Clean, scannable, with a clear CTA.
    """
    title = extract_title(text)
    paragraphs = split_into_paragraphs(text)
    key_points = extract_key_points(text)

    parts = []

    # Subject line suggestions
    parts.append("=" * 60)
    parts.append("EMAIL NEWSLETTER SNIPPET")
    parts.append("=" * 60)
    parts.append("")

    # Subject line options
    parts.append("SUBJECT LINE OPTIONS:")
    parts.append(f"  1. {smart_truncate(title, 60)}")
    if key_points:
        parts.append(f"  2. {smart_truncate(key_points[0], 60)}")
    parts.append(f"  3. [ForgeCadNeo] {smart_truncate(title, 45)}")
    parts.append("")

    # Preview text
    parts.append("PREVIEW TEXT:")
    if paragraphs:
        parts.append(f"  {smart_truncate(paragraphs[0], 100)}")
    parts.append("")

    parts.append("-" * 60)
    parts.append("")

    # Email body
    parts.append(f"Hi {{{{first_name}}}},")
    parts.append("")

    # Opening hook
    if paragraphs:
        parts.append(paragraphs[0])
        parts.append("")

    # Key points
    if key_points:
        parts.append("Here's what you need to know:")
        parts.append("")
        for point in key_points[:4]:
            parts.append(f"  * {smart_truncate(point, 120)}")
        parts.append("")

    # Supporting content
    if len(paragraphs) > 1:
        parts.append(smart_truncate(paragraphs[1], 300))
        parts.append("")

    # CTA
    cta = CTA_LINES["email"]
    parts.append(f">> {cta}")
    parts.append("")

    # Sign-off
    parts.append("Best,")
    parts.append("The ForgeCadNeo Team")
    parts.append("")
    parts.append("-" * 60)
    parts.append("You're receiving this because you signed up at forgecadneo.com")
    parts.append("Unsubscribe: {{{{unsubscribe_link}}}}")

    return "\n".join(parts)


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def write_output(content: str, filepath: Path, label: str):
    """Write content to file and print confirmation."""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  [OK] {label}: {filepath}")


def repurpose_content(
    input_text: str,
    output_dir: Path,
    platforms: list | None = None,
):
    """Main repurposing function. Generates all platform variants."""

    if platforms is None:
        platforms = ["twitter", "linkedin", "reddit", "email"]

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    title_slug = re.sub(r"[^a-z0-9]+", "-", extract_title(input_text).lower())[:40]
    prefix = f"{title_slug}-{timestamp}"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nRepurposing content: \"{extract_title(input_text)}\"")
    print(f"Output directory: {output_dir}")
    print(f"Platforms: {', '.join(platforms)}")
    print()

    results = {}

    if "twitter" in platforms:
        tweets = format_twitter_thread(input_text)
        thread_text = "\n\n---\n\n".join(tweets)
        header = f"TWITTER THREAD ({len(tweets)} tweets)\n{'=' * 40}\n\n"
        filepath = output_dir / f"{prefix}-twitter-thread.txt"
        write_output(header + thread_text, filepath, f"Twitter thread ({len(tweets)} tweets)")
        results["twitter"] = {"tweets": len(tweets), "file": str(filepath)}

    if "linkedin" in platforms:
        post = format_linkedin_post(input_text)
        header = f"LINKEDIN POST ({len(post)} chars / {LINKEDIN_CHAR_LIMIT} max)\n{'=' * 40}\n\n"
        filepath = output_dir / f"{prefix}-linkedin-post.txt"
        write_output(header + post, filepath, f"LinkedIn post ({len(post)} chars)")
        results["linkedin"] = {"chars": len(post), "file": str(filepath)}

    if "reddit" in platforms:
        post = format_reddit_post(input_text)
        filepath = output_dir / f"{prefix}-reddit-post.md"
        write_output(post, filepath, "Reddit post (markdown)")
        results["reddit"] = {"file": str(filepath)}

    if "email" in platforms:
        snippet = format_email_newsletter(input_text)
        filepath = output_dir / f"{prefix}-email-newsletter.txt"
        write_output(snippet, filepath, "Email newsletter snippet")
        results["email"] = {"file": str(filepath)}

    # Summary
    print(f"\nDone. Generated {len(results)} platform variant(s).")
    return results


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Repurpose long-form content for social media platforms"
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        help="Path to the input markdown/text file",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read input from stdin instead of a file",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory (default: ./repurposed-content/)",
    )
    parser.add_argument(
        "--platform",
        type=str,
        choices=["twitter", "linkedin", "reddit", "email"],
        help="Generate for a specific platform only",
    )
    args = parser.parse_args()

    # Read input
    if args.stdin:
        input_text = sys.stdin.read()
    elif args.input_file:
        input_path = Path(args.input_file)
        if not input_path.exists():
            print(f"Error: File not found: {args.input_file}")
            sys.exit(1)
        with open(input_path, "r", encoding="utf-8") as f:
            input_text = f.read()
    else:
        # Demo mode with sample content
        input_text = """# Why Legacy 2D Drawings Are Costing Your Manufacturing Company Millions

Every manufacturing company has them — filing cabinets full of legacy 2D engineering drawings from decades past. These aren't just historical artifacts. They represent critical design data that's locked in paper format.

The manual conversion problem is staggering. A skilled mechanical engineer takes 4-8 hours to recreate a single 2D drawing as a 3D CAD model. For a company with 5,000 legacy drawings, that's 20,000-40,000 hours of engineering time.

Here's what most companies don't realize:

- The cost of NOT digitizing is higher than digitizing. Every time an engineer manually references a paper drawing, that's lost productivity.
- Legacy drawings contain critical tribal knowledge — dimensions, tolerances, and design intent that only exists on paper.
- Insurance and compliance requirements increasingly demand digital records of all engineering documentation.
- Supply chain partners need 3D STEP files, not paper drawings. Every manual conversion is a bottleneck.

The solution is automated 2D-to-3D conversion. AI-powered tools can now read engineering drawings, interpret dimensions and GD&T, and generate manufacturing-grade STEP files in minutes instead of hours.

The ROI is clear: what used to take 8 hours now takes 15 minutes. That's a 32x productivity improvement on one of engineering's most tedious tasks.

Companies that digitize their legacy drawing archives gain a competitive advantage — faster quoting, better supply chain integration, and reduced engineering bottleneck on routine conversion work.

The question isn't whether to digitize your legacy drawings. It's how fast you can do it before your competitors do.
"""
        print("No input file specified — using built-in demo content.")
        print("Use: python3 repurpose-content.py your-article.md\n")

    if not input_text.strip():
        print("Error: Input is empty.")
        sys.exit(1)

    # Set output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        script_dir = Path(__file__).parent.resolve()
        output_dir = script_dir / "repurposed-content"

    # Determine platforms
    platforms = [args.platform] if args.platform else None

    # Run repurposing
    repurpose_content(input_text, output_dir, platforms)


if __name__ == "__main__":
    main()
