.PHONY: help setup copy lint test clean

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "  make setup    - Initial setup (install dependencies if any)"
	@echo "  make copy     - Copy .claude/ to target project"
	@echo "  make lint     - Check markdown files"
	@echo "  make test     - Validate configuration files"
	@echo "  make clean    - Remove generated files"
	@echo ""
	@echo "Usage:"
	@echo "  make copy TARGET=/path/to/your/project"

# Setup
setup:
	@echo "No dependencies to install. Ready to use!"
	@echo "Copy .claude/ folder to your project with: make copy TARGET=/path/to/project"

# Copy .claude to target project
copy:
ifndef TARGET
	@echo "Error: TARGET is required"
	@echo "Usage: make copy TARGET=/path/to/your/project"
	@exit 1
endif
	@echo "Copying .claude/ to $(TARGET)..."
	@cp -r .claude $(TARGET)/
	@echo "Done! .claude/ copied to $(TARGET)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Review $(TARGET)/.claude/CLAUDE.md"
	@echo "  2. Set your tier (Starter/Standard/Strict)"
	@echo "  3. Customize rules as needed"

# Lint markdown files
lint:
	@echo "Checking markdown files..."
	@find . -name "*.md" -type f | head -20
	@echo ""
	@echo "Found $$(find . -name "*.md" -type f | wc -l | tr -d ' ') markdown files"
	@echo "Install markdownlint for full linting: npm install -g markdownlint-cli"

# Validate JSON files
test:
	@echo "Validating JSON files..."
	@for f in $$(find . -name "*.json" -type f); do \
		echo "Checking $$f..."; \
		python3 -m json.tool $$f > /dev/null && echo "  ✓ Valid" || echo "  ✗ Invalid"; \
	done
	@echo ""
	@echo "Validation complete!"

# Clean generated files
clean:
	@echo "Nothing to clean. This is a configuration-only repository."

# Count statistics
stats:
	@echo "Repository Statistics:"
	@echo ""
	@echo "Rules:      $$(find .claude/rules -name "*.md" | wc -l | tr -d ' ')"
	@echo "Agents:     $$(find .claude/agents -name "*.md" | wc -l | tr -d ' ')"
	@echo "Commands:   $$(find .claude/commands -name "*.md" | wc -l | tr -d ' ')"
	@echo "Skills:     $$(find .claude/skills -name "*.md" | wc -l | tr -d ' ')"
	@echo "References: $$(find .claude/references -name "*.md" | wc -l | tr -d ' ')"
	@echo "Examples:   $$(find examples -type f | wc -l | tr -d ' ')"
	@echo ""
	@echo "Total lines of configuration:"
	@find .claude -name "*.md" -exec cat {} \; | wc -l | tr -d ' '
