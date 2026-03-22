import { NextRequest, NextResponse } from "next/server";

const USER_AGENT = "ForgeCadNeo-Dashboard/1.0 (marketing automation scanner)";

interface RedditSearchChild {
  data: {
    id: string;
    title: string;
    subreddit: string;
    selftext: string;
    score: number;
  };
}

interface RedditSearchListing {
  data: {
    children: RedditSearchChild[];
  };
}

/**
 * POST /api/reddit/suggest-keywords
 *
 * Takes seed keywords and analyzes Reddit search results to discover
 * related keywords using frequency analysis of top post titles and content.
 *
 * Body: { keywords: string[], subreddits?: string[] }
 * Returns: { data: { suggestions: KeywordSuggestion[] } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, subreddits } = body as {
      keywords: string[];
      subreddits?: string[];
    };

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "keywords must be a non-empty array" },
        { status: 400 }
      );
    }

    // Step 1: Search Reddit for each seed keyword to find related posts
    const allPostTexts: string[] = [];
    const relatedSubreddits = new Map<string, number>();

    // Search within each specified subreddit for each keyword
    const searchSubs = subreddits?.length
      ? subreddits.slice(0, 5)
      : ["all"];

    for (const sub of searchSubs) {
      for (const keyword of keywords.slice(0, 3)) {
        try {
          const query = encodeURIComponent(keyword);
          const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=${query}&restrict_sr=1&sort=relevance&limit=25&t=year`;

          const response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
          });

          if (!response.ok) continue;

          const listing = (await response.json()) as RedditSearchListing;
          const posts = listing.data?.children ?? [];

          for (const post of posts) {
            const { data: p } = post;
            allPostTexts.push(`${p.title} ${p.selftext || ""}`);

            // Track subreddits where these posts appear
            const postSub = p.subreddit.toLowerCase();
            relatedSubreddits.set(
              postSub,
              (relatedSubreddits.get(postSub) || 0) + 1
            );
          }
        } catch {
          continue;
        }

        // Brief pause to avoid Reddit rate limiting
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // Step 2: Extract meaningful multi-word phrases (bigrams and trigrams) from post texts
    const seedLower = new Set(keywords.map((k) => k.toLowerCase().trim()));
    const phraseFreq = new Map<string, number>();

    // Common stop words to filter out
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
      "be", "has", "have", "had", "do", "does", "did", "will", "would",
      "could", "should", "may", "might", "can", "not", "no", "so", "if",
      "my", "your", "his", "her", "its", "our", "their", "i", "you", "he",
      "she", "we", "they", "me", "him", "us", "them", "what", "which",
      "who", "how", "when", "where", "why", "all", "each", "every", "any",
      "more", "most", "other", "some", "just", "been", "being", "very",
      "about", "up", "out", "into", "over", "after", "also", "than",
      "then", "only", "now", "here", "there", "new", "one", "two", "like",
      "get", "got", "use", "used", "using", "way", "want", "need", "know",
      "think", "make", "going", "looking", "anyone", "much", "really",
      "still", "even", "well", "back", "right", "good", "best", "first",
      "try", "tried", "trying", "lot", "don", "doesn", "didn", "won",
      "amp", "nbsp", "https", "http", "www", "com", "reddit",
      // Additional common words that add noise
      "these", "those", "while", "because", "something", "would", "people",
      "though", "through", "another", "before", "between", "without",
      "already", "however", "actually", "pretty", "since", "always",
      "never", "everything", "nothing", "anything", "someone", "thing",
      "things", "work", "works", "working", "worked", "made", "making",
      "many", "take", "takes", "taking", "same", "different", "done",
      "said", "says", "start", "started", "come", "comes", "went",
      "long", "able", "point", "down", "help", "seem", "seems",
      "sure", "find", "found", "left", "both", "keep", "last",
      "part", "call", "called", "tell", "told", "give", "given",
      "whole", "look", "looks", "seem", "turn", "show", "shows",
      "feel", "felt", "kind", "sort", "type", "based", "being",
      "change", "changed", "post", "posted", "posts", "comment",
      "comments", "thread", "edit", "update", "width", "height",
      "size", "color", "image", "images", "file", "files", "link",
      "text", "page", "great", "might", "maybe", "pok", "mon",
      "thanks", "thank", "please", "create", "created", "project",
      "projects", "version", "format", "preview", "auto", "png",
      "jpg", "jpeg", "gif", "video", "youtube",
    ]);

    for (const text of allPostTexts) {
      // Clean text and split into words
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s\-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      // Extract bigrams (2-word phrases)
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (!seedLower.has(bigram)) {
          phraseFreq.set(bigram, (phraseFreq.get(bigram) || 0) + 1);
        }
      }

      // Extract trigrams (3-word phrases)
      for (let i = 0; i < words.length - 2; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (!seedLower.has(trigram)) {
          phraseFreq.set(trigram, (phraseFreq.get(trigram) || 0) + 1);
        }
      }

      // Extract single meaningful words (require longer length for singles)
      for (const word of words) {
        if (word.length > 5 && !seedLower.has(word)) {
          phraseFreq.set(word, (phraseFreq.get(word) || 0) + 1);
        }
      }
    }

    // Step 3: Rank phrases by frequency, filter out noise
    const minFrequency = 3;
    const ranked = Array.from(phraseFreq.entries())
      .filter(([phrase, freq]) => {
        if (freq < minFrequency) return false;
        // Filter out phrases that are subsets of seed keywords
        for (const seed of seedLower) {
          if (seed.includes(phrase) || phrase.includes(seed as string)) {
            return false;
          }
        }
        // Filter out garbage patterns (URLs, dashes, non-word noise)
        if (/^[-\s]+$/.test(phrase)) return false;
        if (/^\d+$/.test(phrase)) return false;
        if (phrase.includes("redd") || phrase.includes("webp")) return false;
        if (phrase.includes("http") || phrase.includes("www")) return false;
        // Must contain at least one alphabetic character
        if (!/[a-z]/.test(phrase)) return false;
        // Filter single words that are too generic
        if (!phrase.includes(" ") && phrase.length < 6) return false;
        return true;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Step 4: Build suggestion objects with relevance scores
    const maxFreq = ranked.length > 0 ? ranked[0][1] : 1;
    const suggestions = ranked.map(([phrase, freq]) => ({
      keyword: phrase,
      relevance: Math.round((freq / maxFreq) * 100),
      frequency: freq,
      source: "reddit_analysis" as const,
    }));

    // Step 5: Add top related subreddits not already in the user's list
    const configuredSubs = new Set(
      (subreddits || []).map((s) => s.toLowerCase())
    );
    const suggestedSubreddits = Array.from(relatedSubreddits.entries())
      .filter(([sub]) => !configuredSubs.has(sub))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([sub, count]) => ({ name: sub, postCount: count }));

    return NextResponse.json({
      data: {
        suggestions,
        suggestedSubreddits,
        analyzedPosts: allPostTexts.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to suggest keywords", details: message },
      { status: 500 }
    );
  }
}
