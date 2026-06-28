#!/bin/bash

# Build all WebAssembly projects one level deep

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BOLD}🔨 Building all wasm-pack projects in subdirectories...${NC}"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
START_TOTAL=$(date +%s)

for dir in */; do
    # Skip if no directories found
    [ -d "$dir" ] || continue
    
    if [ -f "${dir}Cargo.toml" ]; then
        echo -e "${BLUE}📦 Building:${NC} ${BOLD}$dir${NC}"
        echo "----------------------------------------"
        
        START_TIME=$(date +%s)
        if (cd "$dir" && wasm-pack build --target web --release); then
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            echo "----------------------------------------"
            echo -e "${GREEN}✅ Success:${NC} $dir ${GREEN}(${DURATION}s)${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo "----------------------------------------"
            echo -e "${RED}❌ Failed:${NC} $dir"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping${NC} (no Cargo.toml): $dir"
        echo "----------------------------------------"
        SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
    echo ""
done

END_TOTAL=$(date +%s)
TOTAL_DURATION=$((END_TOTAL - START_TOTAL))

# Always show the summary
echo "========================================="
echo -e "${BOLD}✨ Build Summary${NC}"
echo "========================================="
echo -e "${GREEN}✅ Success:${NC} $SUCCESS_COUNT"
echo -e "${RED}❌ Failed:${NC}  $FAIL_COUNT"
echo -e "${YELLOW}⏭️  Skipped:${NC} $SKIP_COUNT"
echo -e "${BLUE}⏱️  Total time:${NC} ${TOTAL_DURATION}s"
echo "========================================="

# Exit with error if any builds failed
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi