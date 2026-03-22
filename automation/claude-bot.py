#!/usr/bin/env python3
"""
Claude Bot Integration for ForgeCadNeo
========================================
Reusable module wrapping Anthropic's Claude API for content generation
across all ForgeCadNeo marketing automation scripts.

Features:
    - Generate contextual Reddit replies
    - Generate LinkedIn posts
    - Generate tweets
    - Repurpose content across platforms
    - Suggest relevant subreddits
    - Analyze post engagement
    - ForgeCadNeo product context baked into system prompts

Usage as module:
    from claude_bot import ClaudeBot
    bot = ClaudeBot()
    reply = bot.generate_reddit_reply(title, body, subreddit)

Usage as CLI:
    python claude-bot.py --action reply --title "Need CAD conversion help" --body "..."
    python claude-bot.py --action linkedin --topic "Legacy drawing digitization"
    python claude-bot.py --action tweet --topic "Free STEP viewer"
    python claude-bot.py --action suggest-subreddits
    python claude-bot.py --action repurpose --input article.md --platform twitter
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# Product context injected into all prompts
FORGECADNEO_CONTEXT = """
You are a helpful assistant that also happens to know about ForgeCadNeo, an
AI-powered platform for engineering CAD work. Here is the product context you
may reference ONLY when it is genuinely relevant and helpful:

PRODUCT: ForgeCadNeo
URL: https://forgecadneo.com
FREE VIEWER: https://forgecadneo.com/viewer (no login required)
TAGLINE: AI-powered 2D to 3D CAD conversion

WHAT IT DOES:
- Converts 2D engineering drawings (orthographic projections, scanned blueprints,
  PDFs, annotated drawings) into manufacturing-grade 3D STEP files
- Text-to-3D: describe a part in plain English and get a parametric 3D model
- Six frontier AI models (GPT-5.2, Claude Opus 4.6, Claude Sonnet 4.6,
  Gemini 3.1 Pro, GPT-4o, Gemini 2.5 Flash) compete on every generation
- STEP AP214 export via pythonOCC for sub-micron precision B-Rep geometry
- Multi-part assembly detection with exploded views, BOM, LEGO-style instructions
- Free browser-based STEP/STL viewer with CAD editing tools (boolean ops,
  fillets, chamfers, shell, mirror, scale) at /viewer
- Parametric sliders for real-time dimension adjustment via OpenSCAD WASM
- Chat-based model refinement with full version history

PRICING:
- Free tier: 3 credits, no credit card required
- Pro: $29/month, 50 credits, 5 free refinements per generation
- Enterprise: custom pricing, 200+ credits, unlimited refinements

KEY DIFFERENTIATORS:
- Reads actual dimensions, tolerances, and GD&T from drawings (not just tracing)
- Generates parametric OpenSCAD code (editable, not static meshes)
- Six AI models compete for best accuracy per drawing
- Manufacturing-grade STEP output, not approximate mesh conversions
- In-browser compilation via WebAssembly (no server round-trip for previews)

USE CASES:
- Legacy drawing digitization for manufacturing companies
- Converting paper blueprints to 3D for supply chain partners needing STEP files
- Rapid prototyping: text-to-3D for brackets, enclosures, fixtures, jigs
- PLM migration: bulk conversion of drawing archives
- Quick STEP/STL viewing without installing CAD software

IMPORTANT GUIDELINES FOR MENTIONING THE PRODUCT:
- Only mention ForgeCadNeo when it is genuinely relevant to the conversation
- Always be helpful FIRST. The reply should provide value even without the product mention
- Never be pushy or salesy. Use a conversational, technical tone
- If the topic is not related to CAD/engineering/3D/manufacturing, do NOT mention the product
- When mentioning, keep it brief and natural, like "I've been using X for this" or
  "there are tools like X that can help"
""".strip()

# Default models
DEFAULT_MODEL = "claude-sonnet-4-6"
QUALITY_MODEL = "claude-opus-4-6"

logger = logging.getLogger("claude-bot")


# =============================================================================
# CLAUDE BOT CLASS
# =============================================================================

class ClaudeBot:
    """Wraps Anthropic's Claude API for ForgeCadNeo content generation."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        quality_model: str = QUALITY_MODEL,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ):
        """
        Initialize the Claude bot.

        Args:
            api_key: Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.
            model: Default model for fast operations.
            quality_model: Model for high-quality operations.
            max_tokens: Maximum response tokens.
            temperature: Sampling temperature.
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model
        self.quality_model = quality_model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._client = None

        if not self.api_key:
            logger.warning(
                "ANTHROPIC_API_KEY not set. Claude bot will not function. "
                "Set it via environment variable or pass api_key= to constructor."
            )

    @property
    def client(self):
        """Lazy-initialize the Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "anthropic package not installed. Run: pip install anthropic"
                )
        return self._client

    def _call_claude(
        self,
        system_prompt: str,
        user_prompt: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Make a call to the Claude API with retry logic.

        Args:
            system_prompt: System-level instructions.
            user_prompt: The user message.
            model: Override the default model.
            max_tokens: Override max tokens.
            temperature: Override temperature.

        Returns:
            The text content of Claude's response.
        """
        if not self.api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not configured. Cannot call Claude API."
            )

        _model = model or self.model
        _max_tokens = max_tokens or self.max_tokens
        _temperature = temperature or self.temperature

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.client.messages.create(
                    model=_model,
                    max_tokens=_max_tokens,
                    temperature=_temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                return response.content[0].text
            except Exception as e:
                error_str = str(e)
                if "rate_limit" in error_str.lower() or "429" in error_str:
                    wait_time = 30 * (attempt + 1)
                    logger.warning(
                        f"Rate limited by Anthropic API. "
                        f"Waiting {wait_time}s (attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(wait_time)
                elif attempt < max_retries - 1:
                    logger.warning(
                        f"Claude API error (attempt {attempt + 1}/{max_retries}): {e}"
                    )
                    time.sleep(5)
                else:
                    logger.error(f"Claude API call failed after {max_retries} attempts: {e}")
                    raise

        return ""

    # -------------------------------------------------------------------------
    # Content Generation Methods
    # -------------------------------------------------------------------------

    def generate_reddit_reply(
        self,
        post_title: str,
        post_body: str,
        subreddit: str,
        product_context: Optional[str] = None,
        use_quality_model: bool = False,
    ) -> str:
        """
        Generate a contextual, helpful Reddit reply.

        The reply is genuinely helpful first, with a subtle ForgeCadNeo mention
        only when the topic is relevant to CAD/engineering/3D.

        Args:
            post_title: Title of the Reddit post.
            post_body: Body text of the Reddit post.
            subreddit: Name of the subreddit (without r/).
            product_context: Optional additional product context.
            use_quality_model: Use the higher-quality model.

        Returns:
            Generated reply text.
        """
        system = f"""{FORGECADNEO_CONTEXT}

{product_context or ""}

You are writing a Reddit reply in r/{subreddit}. Follow these rules strictly:

1. BE GENUINELY HELPFUL FIRST. Your reply must provide real value, actionable
   advice, or thoughtful insight regardless of any product mention.
2. Write in a natural, conversational Reddit tone. No corporate speak.
3. Match the technical level of the subreddit and the original post.
4. If the post is about CAD, engineering drawings, 2D-to-3D conversion,
   STEP files, or related topics, you may mention ForgeCadNeo briefly and
   naturally as ONE option among others. Frame it as "I've been using..."
   or "there's a tool that does this..." -- never as an advertisement.
5. If the post is NOT related to CAD/engineering/3D, do NOT mention
   ForgeCadNeo at all. Just be helpful.
6. Keep the reply concise (2-4 paragraphs max). Reddit hates walls of text.
7. Never use marketing language, superlatives, or hype.
8. Ask a follow-up question when appropriate to encourage discussion.
9. Do NOT use emojis or excessive formatting.
10. Do NOT start with "Great question!" or similar patronizing openers.
"""

        user = f"""Reddit post in r/{subreddit}:

Title: {post_title}

Body:
{post_body[:2000]}

Write a helpful, natural reply to this post."""

        model = self.quality_model if use_quality_model else self.model
        return self._call_claude(system, user, model=model, max_tokens=800)

    def generate_linkedin_post(
        self,
        topic: str,
        features: Optional[list[str]] = None,
        tone: str = "professional-technical",
    ) -> str:
        """
        Generate a LinkedIn-formatted post.

        Args:
            topic: The topic or theme of the post.
            features: Specific features to highlight (optional).
            tone: Writing tone (professional-technical, storytelling, data-driven).

        Returns:
            LinkedIn post text (max ~1300 chars).
        """
        features_text = ""
        if features:
            features_text = "\nFeatures to potentially reference:\n" + "\n".join(
                f"- {f}" for f in features
            )

        system = f"""{FORGECADNEO_CONTEXT}

You are writing a LinkedIn post. Follow these guidelines:

1. LinkedIn best practices: hook in the first 2 lines, use line breaks for
   readability, end with engagement question or CTA.
2. Tone: {tone}. Technical authority without being dry. Builder transparency.
3. Keep it under 1300 characters total (LinkedIn's limit for full display).
4. Include 3-5 relevant hashtags at the end.
5. Focus on providing value and insight, not just promoting the product.
6. Use data points and specific numbers when possible.
7. No emojis. No exclamation marks in excess.
8. Write as the founder/builder, first person.
"""

        user = f"""Write a LinkedIn post about: {topic}
{features_text}

The post should feel like genuine thought leadership from an engineer
building in the CAD/manufacturing space, not a product announcement."""

        return self._call_claude(system, user, max_tokens=600)

    def generate_tweet(
        self,
        topic: str,
        features: Optional[list[str]] = None,
    ) -> str:
        """
        Generate a tweet (max 280 characters).

        Args:
            topic: The topic or theme.
            features: Specific features to mention (optional).

        Returns:
            Tweet text (max 280 chars).
        """
        features_text = ""
        if features:
            features_text = "\nRelevant features: " + ", ".join(features)

        system = f"""{FORGECADNEO_CONTEXT}

You are writing a single tweet. Rules:
1. MUST be under 280 characters total (including any hashtags or URLs).
2. Be concise, direct, and interesting.
3. Technical credibility over hype.
4. Include forgecadneo.com only if space allows.
5. 1-2 hashtags maximum if space allows.
6. No emojis.
7. Write as the builder, first person.
"""

        user = f"""Write a single tweet about: {topic}
{features_text}

Keep it under 280 characters. Be direct and technical."""

        return self._call_claude(system, user, max_tokens=150)

    def repurpose_content(
        self,
        long_content: str,
        target_platform: str,
    ) -> str:
        """
        Repurpose long-form content for a specific platform.

        Args:
            long_content: The original long-form content (article, blog post).
            target_platform: One of "reddit", "linkedin", "twitter", "email".

        Returns:
            Content reformatted for the target platform.
        """
        platform_instructions = {
            "reddit": (
                "Convert to a Reddit post format. Use markdown. Include a TL;DR. "
                "Keep it conversational and community-oriented. Ask an engagement "
                "question at the end. No excessive self-promotion."
            ),
            "linkedin": (
                "Convert to a LinkedIn post (max 1300 chars). Hook in the first "
                "2 lines. Use line breaks. End with a question. Add 3-5 hashtags."
            ),
            "twitter": (
                "Convert to a Twitter thread (each tweet under 280 chars). "
                "Start with a strong hook tweet. Number tweets like 1/N. "
                "End with a CTA tweet."
            ),
            "email": (
                "Convert to an email newsletter snippet. Clear subject line, "
                "scannable format, bullet points for key takeaways, strong CTA."
            ),
        }

        instruction = platform_instructions.get(
            target_platform,
            f"Convert for {target_platform} platform following best practices."
        )

        system = f"""{FORGECADNEO_CONTEXT}

You are repurposing content for the {target_platform} platform.
{instruction}

Maintain the core message and key data points from the original content.
Adjust tone, length, and formatting for the target platform."""

        user = f"""Original content:

{long_content[:4000]}

Repurpose this for {target_platform}."""

        max_tokens = 1200 if target_platform == "twitter" else 800
        return self._call_claude(system, user, max_tokens=max_tokens)

    def suggest_subreddits(
        self,
        product_description: Optional[str] = None,
    ) -> str:
        """
        Suggest relevant subreddits for ForgeCadNeo marketing.

        Args:
            product_description: Optional custom description. Falls back to
                built-in product context.

        Returns:
            Formatted list of subreddit suggestions with reasoning.
        """
        system = """You are a Reddit marketing strategist who specializes in
B2B SaaS and engineering/manufacturing tools. You understand Reddit culture
and know that genuine community participation beats self-promotion.

Suggest subreddits where the product could be discussed naturally and
where the target audience (mechanical engineers, manufacturing professionals,
CAD users) actually spends time.

For each subreddit, include:
- Subreddit name
- Subscriber count estimate
- Relevance score (1-10)
- Best type of post for that community
- Key rules to follow
- Example post angle that would work
"""

        desc = product_description or (
            "ForgeCadNeo: AI-powered 2D engineering drawing to 3D STEP file "
            "conversion. Also text-to-3D and free STEP/STL viewer. Target "
            "audience: mechanical engineers, manufacturing companies, CAD users."
        )

        user = f"""Suggest the best subreddits for this product:

{desc}

Focus on communities where the product solves a real problem the members
actually discuss. Avoid generic tech subreddits unless there is a specific angle."""

        return self._call_claude(system, user, max_tokens=1500)

    def analyze_post_engagement(
        self,
        post_text: str,
        metrics: Optional[dict] = None,
    ) -> str:
        """
        Analyze a post's engagement and suggest improvements.

        Args:
            post_text: The text of the post.
            metrics: Optional dict with keys like upvotes, comments,
                     impressions, click_rate, etc.

        Returns:
            Analysis with specific improvement suggestions.
        """
        metrics_text = ""
        if metrics:
            metrics_text = "\nPerformance metrics:\n" + json.dumps(metrics, indent=2)

        system = """You are a content strategist specializing in technical B2B
marketing on social media platforms (Reddit, LinkedIn, Twitter). Analyze the
given post and provide specific, actionable feedback.

Structure your analysis as:
1. STRENGTHS: What works well (2-3 points)
2. WEAKNESSES: What could be improved (2-3 points)
3. HOOK ANALYSIS: Is the opening compelling? How to improve it.
4. CTA ANALYSIS: Is there a clear next step? How to strengthen it.
5. REWRITE: Provide a rewritten version incorporating your suggestions.
"""

        user = f"""Analyze this post and suggest improvements:

{post_text[:3000]}
{metrics_text}

Be specific and actionable in your feedback."""

        return self._call_claude(system, user, max_tokens=1500)

    def generate_content_ideas(
        self,
        platform: str = "reddit",
        count: int = 5,
        focus: Optional[str] = None,
    ) -> str:
        """
        Generate content ideas for a given platform.

        Args:
            platform: Target platform.
            count: Number of ideas to generate.
            focus: Optional focus area (e.g., "pain points", "technical deep-dives").

        Returns:
            Numbered list of content ideas with brief descriptions.
        """
        focus_text = f"\nFocus area: {focus}" if focus else ""

        system = f"""{FORGECADNEO_CONTEXT}

You are a content strategist for engineering/manufacturing SaaS products.
Generate {count} content ideas for {platform} that would resonate with
mechanical engineers, CAD users, and manufacturing professionals.

Each idea should include:
- A compelling title/hook
- A 2-sentence description of the content
- Why it would resonate with the audience
- Expected engagement level (low/medium/high)
"""

        user = f"""Generate {count} content ideas for {platform}.
{focus_text}

Ideas should be a mix of educational, engagement-driving, and product-related
content. Prioritize ideas that provide genuine value to the community."""

        return self._call_claude(system, user, max_tokens=1500)


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Claude Bot — AI content generation for ForgeCadNeo marketing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python claude-bot.py --action reply --title "Need CAD help" --body "Looking for conversion tools"
  python claude-bot.py --action linkedin --topic "Legacy drawing digitization"
  python claude-bot.py --action tweet --topic "Free STEP viewer launch"
  python claude-bot.py --action repurpose --input article.md --platform twitter
  python claude-bot.py --action suggest-subreddits
  python claude-bot.py --action analyze --input post.txt
  python claude-bot.py --action ideas --platform reddit --count 10
        """,
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=[
            "reply", "linkedin", "tweet", "repurpose",
            "suggest-subreddits", "analyze", "ideas",
        ],
        help="The type of content to generate",
    )
    parser.add_argument("--title", type=str, help="Post title (for reply action)")
    parser.add_argument("--body", type=str, help="Post body text (for reply action)")
    parser.add_argument("--subreddit", type=str, default="cad", help="Subreddit name (for reply action)")
    parser.add_argument("--topic", type=str, help="Topic/theme (for linkedin, tweet actions)")
    parser.add_argument("--input", type=str, help="Input file path (for repurpose, analyze actions)")
    parser.add_argument("--platform", type=str, help="Target platform (for repurpose, ideas actions)")
    parser.add_argument("--count", type=int, default=5, help="Number of ideas (for ideas action)")
    parser.add_argument("--focus", type=str, help="Focus area (for ideas action)")
    parser.add_argument("--model", type=str, help="Override the default Claude model")
    parser.add_argument("--quality", action="store_true", help="Use the higher-quality model")
    parser.add_argument(
        "--features",
        type=str,
        nargs="*",
        help="Features to highlight (for linkedin, tweet actions)",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Initialize bot
    bot = ClaudeBot()
    if args.model:
        bot.model = args.model
    if args.quality:
        bot.model = bot.quality_model

    try:
        if args.action == "reply":
            if not args.title:
                print("Error: --title is required for the reply action.")
                sys.exit(1)
            body = args.body or ""
            if not body and args.input:
                body = Path(args.input).read_text(encoding="utf-8")
            result = bot.generate_reddit_reply(
                args.title, body, args.subreddit, use_quality_model=args.quality
            )

        elif args.action == "linkedin":
            if not args.topic:
                print("Error: --topic is required for the linkedin action.")
                sys.exit(1)
            result = bot.generate_linkedin_post(args.topic, args.features)

        elif args.action == "tweet":
            if not args.topic:
                print("Error: --topic is required for the tweet action.")
                sys.exit(1)
            result = bot.generate_tweet(args.topic, args.features)

        elif args.action == "repurpose":
            if not args.input:
                print("Error: --input file is required for the repurpose action.")
                sys.exit(1)
            content = Path(args.input).read_text(encoding="utf-8")
            platform = args.platform or "linkedin"
            result = bot.repurpose_content(content, platform)

        elif args.action == "suggest-subreddits":
            result = bot.suggest_subreddits()

        elif args.action == "analyze":
            if not args.input:
                print("Error: --input file is required for the analyze action.")
                sys.exit(1)
            content = Path(args.input).read_text(encoding="utf-8")
            result = bot.analyze_post_engagement(content)

        elif args.action == "ideas":
            platform = args.platform or "reddit"
            result = bot.generate_content_ideas(platform, args.count, args.focus)

        else:
            print(f"Unknown action: {args.action}")
            sys.exit(1)

        print(result)

    except ValueError as e:
        print(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
