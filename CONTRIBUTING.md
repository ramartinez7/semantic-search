# Contributing to SemanticSearch

## Development Workflow

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** following the coding standards
4. **Test your changes** locally
5. **Submit a pull request**

## Local Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run smoke tests
npm run smoke

# Run linting
npm run lint
```

## Before Submitting a PR

**All PRs must pass these checks (automatically verified by GitHub Actions):**
- ✅ TypeScript compilation (`npm run build`)
- ✅ Smoke tests pass (`npm run smoke`)
- ✅ Type checking passes (`npm run typecheck`)
- ✅ Linting passes (`npm run lint`)

## Automated Checks

GitHub Actions will automatically run these checks on all PRs:
- Build on Node.js 18.x and 20.x
- Build on both Ubuntu and Windows
- TypeScript compilation
- Type checking
- Smoke tests
- Linting

**PRs that fail these checks cannot be merged.**

## Manual Testing (Recommended)

Before submitting your PR, test the CLI locally:

```bash
# Build first
npm run build

# Test basic functionality
node dist/cli.js --version
node dist/cli.js --help

# Test with real Azure OpenAI (if configured)
node dist/cli.js test-connection
```

## Code Standards

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep files under 300 lines when possible
- Use meaningful variable and function names

## Commit Messages

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes  
- `refactor:` for code refactoring
- `chore:` for maintenance tasks
- `docs:` for documentation updates

Example: `feat: add new search filter options`
