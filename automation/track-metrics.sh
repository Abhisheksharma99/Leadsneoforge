#!/bin/bash
#
# ForgeCadNeo — Daily Metrics Tracker
# ====================================
# Tracks Reddit karma, website status, and social metrics.
# Appends daily snapshots to a CSV file for weekly review.
#
# Usage:
#     ./track-metrics.sh                   # Run once, append to CSV
#     ./track-metrics.sh --summary         # Show last 7 days summary
#     ./track-metrics.sh --setup-cron      # Install daily cron job
#
# Cron setup (daily at 11 PM):
#     0 23 * * * /Users/abhisheksharma/work/forgecadneo/automation/track-metrics.sh >> /Users/abhisheksharma/work/forgecadneo/automation/metrics-tracker.log 2>&1
#

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CSV_FILE="${SCRIPT_DIR}/daily-metrics.csv"
LOG_FILE="${SCRIPT_DIR}/metrics-tracker.log"
REDDIT_USERNAME="ForgeCadNeo"
WEBSITE_URL="https://forgecadneo.com"
USER_AGENT="ForgeCadNeo-MetricsTracker/1.0"

# Date/time
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")

# =============================================================================
# FUNCTIONS
# =============================================================================

log() {
    echo "[${NOW}] $1" >&2
}

# Initialize CSV with headers if it doesn't exist
init_csv() {
    if [ ! -f "${CSV_FILE}" ]; then
        echo "date,reddit_post_karma,reddit_comment_karma,reddit_total_karma,website_status,website_response_ms,reddit_matches_count,posts_scheduled,posts_published" > "${CSV_FILE}"
        log "Created new CSV file: ${CSV_FILE}"
    fi
}

# Check if we already have an entry for today
check_duplicate() {
    if grep -q "^${TODAY}," "${CSV_FILE}" 2>/dev/null; then
        log "Entry for ${TODAY} already exists. Updating..."
        # Remove existing entry for today
        grep -v "^${TODAY}," "${CSV_FILE}" > "${CSV_FILE}.tmp" || true
        mv "${CSV_FILE}.tmp" "${CSV_FILE}"
    fi
}

# Scrape Reddit profile karma (public, no API key needed)
get_reddit_karma() {
    local post_karma=0
    local comment_karma=0
    local total_karma=0

    # Fetch Reddit user page as JSON
    local response
    response=$(curl -s -A "${USER_AGENT}" \
        --max-time 10 \
        "https://www.reddit.com/user/${REDDIT_USERNAME}/about.json" 2>/dev/null || echo "{}")

    # Parse karma values using Python (available on macOS)
    if echo "${response}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['link_karma'])" 2>/dev/null; then
        post_karma=$(echo "${response}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['link_karma'])" 2>/dev/null || echo 0)
        comment_karma=$(echo "${response}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['comment_karma'])" 2>/dev/null || echo 0)
        total_karma=$((post_karma + comment_karma))
        log "Reddit karma: post=${post_karma}, comment=${comment_karma}, total=${total_karma}"
    else
        log "WARNING: Could not fetch Reddit karma (user may not exist yet or rate limited)"
        post_karma="N/A"
        comment_karma="N/A"
        total_karma="N/A"
    fi

    echo "${post_karma},${comment_karma},${total_karma}"
}

# Check website status and response time
check_website() {
    local status_code=0
    local response_time=0

    # Use curl to check website
    local curl_output
    curl_output=$(curl -s -o /dev/null -w "%{http_code},%{time_total}" \
        --max-time 15 \
        -A "${USER_AGENT}" \
        "${WEBSITE_URL}" 2>/dev/null || echo "000,0")

    status_code=$(echo "${curl_output}" | cut -d',' -f1)
    response_time=$(echo "${curl_output}" | cut -d',' -f2)

    # Convert response time to milliseconds
    response_ms=$(python3 -c "print(int(float('${response_time}') * 1000))" 2>/dev/null || echo 0)

    if [ "${status_code}" = "200" ] || [ "${status_code}" = "301" ] || [ "${status_code}" = "302" ]; then
        log "Website: UP (HTTP ${status_code}, ${response_ms}ms)"
    else
        log "WARNING: Website returned HTTP ${status_code} (${response_ms}ms)"
    fi

    echo "${status_code},${response_ms}"
}

# Count Reddit keyword matches from monitor
count_reddit_matches() {
    local matches_file="${SCRIPT_DIR}/reddit-matches.json"
    local count=0

    if [ -f "${matches_file}" ]; then
        count=$(python3 -c "
import json
with open('${matches_file}', 'r') as f:
    data = json.load(f)
    print(len(data))
" 2>/dev/null || echo 0)
    fi

    log "Reddit keyword matches tracked: ${count}"
    echo "${count}"
}

# Count scheduled vs published posts from content queue
count_posts() {
    local queue_file="${SCRIPT_DIR}/content-queue.md"
    local log_file="${SCRIPT_DIR}/posted-log.json"
    local scheduled=0
    local published=0

    if [ -f "${queue_file}" ]; then
        scheduled=$(grep -c "status: pending" "${queue_file}" 2>/dev/null || echo 0)
    fi

    if [ -f "${log_file}" ]; then
        published=$(python3 -c "
import json
with open('${log_file}', 'r') as f:
    data = json.load(f)
    print(len(data))
" 2>/dev/null || echo 0)
    fi

    log "Posts: ${scheduled} scheduled, ${published} published"
    echo "${scheduled},${published}"
}

# Show summary of last N days
show_summary() {
    local days=${1:-7}

    if [ ! -f "${CSV_FILE}" ]; then
        echo "No metrics data found. Run the tracker first."
        exit 1
    fi

    echo ""
    echo "=============================================="
    echo "ForgeCadNeo Metrics Summary (Last ${days} days)"
    echo "=============================================="
    echo ""

    # Show header + last N lines
    head -1 "${CSV_FILE}"
    tail -n "${days}" "${CSV_FILE}"

    echo ""

    # Calculate trends using Python
    python3 << 'PYEOF'
import csv
import sys

csv_file = sys.argv[1] if len(sys.argv) > 1 else "daily-metrics.csv"

try:
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if len(rows) < 2:
        print("Not enough data for trend analysis yet.")
        sys.exit(0)

    # Last entry
    latest = rows[-1]
    previous = rows[-2]

    print("--- Trends ---")

    # Karma trend
    try:
        curr_karma = int(latest.get('reddit_total_karma', 0))
        prev_karma = int(previous.get('reddit_total_karma', 0))
        diff = curr_karma - prev_karma
        direction = "+" if diff >= 0 else ""
        print(f"Reddit karma: {curr_karma} ({direction}{diff} from yesterday)")
    except (ValueError, TypeError):
        print("Reddit karma: N/A")

    # Website status
    status = latest.get('website_status', 'N/A')
    resp_ms = latest.get('website_response_ms', 'N/A')
    print(f"Website: HTTP {status} ({resp_ms}ms)")

    # Match count
    matches = latest.get('reddit_matches_count', '0')
    print(f"Reddit matches tracked: {matches}")

    # Posts
    scheduled = latest.get('posts_scheduled', '0')
    published = latest.get('posts_published', '0')
    print(f"Content queue: {scheduled} pending, {published} published")

    print("")

except FileNotFoundError:
    print(f"File not found: {csv_file}")
except Exception as e:
    print(f"Error reading metrics: {e}")
PYEOF

}

# Set up a daily cron job
setup_cron() {
    local cron_entry="0 23 * * * ${SCRIPT_DIR}/track-metrics.sh >> ${LOG_FILE} 2>&1"

    # Check if already installed
    if crontab -l 2>/dev/null | grep -q "track-metrics.sh"; then
        echo "Cron job already exists:"
        crontab -l | grep "track-metrics.sh"
        echo ""
        echo "To remove: crontab -e (and delete the line)"
        return
    fi

    # Add to crontab
    (crontab -l 2>/dev/null; echo "${cron_entry}") | crontab -

    echo "Cron job installed successfully:"
    echo "  ${cron_entry}"
    echo ""
    echo "Metrics will be collected daily at 11 PM."
    echo "CSV output: ${CSV_FILE}"
    echo "Log output: ${LOG_FILE}"
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Handle arguments
    case "${1:-}" in
        --summary)
            show_summary "${2:-7}"
            exit 0
            ;;
        --setup-cron)
            setup_cron
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [--summary [days]] [--setup-cron] [--help]"
            echo ""
            echo "Options:"
            echo "  (none)         Collect today's metrics and append to CSV"
            echo "  --summary N    Show last N days summary (default: 7)"
            echo "  --setup-cron   Install daily cron job (11 PM)"
            echo "  --help         Show this help message"
            exit 0
            ;;
    esac

    log "Starting daily metrics collection..."

    # Initialize
    init_csv
    check_duplicate

    # Collect metrics
    log "Collecting Reddit karma..."
    reddit_karma=$(get_reddit_karma)

    log "Checking website status..."
    website_status=$(check_website)

    log "Counting Reddit matches..."
    reddit_matches=$(count_reddit_matches)

    log "Counting content posts..."
    posts_count=$(count_posts)

    # Append to CSV
    echo "${TODAY},${reddit_karma},${website_status},${reddit_matches},${posts_count}" >> "${CSV_FILE}"

    log "Metrics saved to ${CSV_FILE}"
    log "Done."

    # Show today's entry
    echo ""
    echo "Today's metrics:"
    head -1 "${CSV_FILE}"
    tail -1 "${CSV_FILE}"
    echo ""
}

main "$@"
