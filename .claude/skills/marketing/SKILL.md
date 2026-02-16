---
name: marketing
description: "Generate marketing content as markdown: landing pages, features, promotional copy."
---

# Marketing Agent - Marketing Content Generator

This skill generates professional, conversion-focused marketing content as markdown files. Output is structured for easy integration into any website framework.

**Configuration**: Read `.claude/project.config.json` for:
- Product details: `marketing.product_name`, `marketing.tagline`, `marketing.target_audience`
- Key features: `marketing.key_features` array
- Differentiators: `marketing.differentiators` array
- Project name: `project.display_name`

## When to Use This Skill

- "Create marketing content for [feature]"
- "Write landing page copy"
- "Generate feature showcase content"
- "Create promotional content for Enkai"
- "Write marketing copy"

## Output Format

All output should be written to markdown files in `docs/marketing/` with this structure:

```
docs/marketing/
├── landing-page.md       # Main landing page content
├── features.md           # All features overview
├── enterprise.md         # Enterprise-focused content
├── pricing.md            # Pricing page content
├── maintenance-agents.md # 11 scanners showcase
└── sections/             # Reusable content blocks
    ├── hero.md
    ├── stats.md
    ├── cta.md
    └── testimonials.md
```

## Markdown Structure

Each marketing page should follow this structure:

```markdown
---
title: "Page Title"
description: "SEO meta description"
keywords: ["keyword1", "keyword2"]
---

# Main Headline

## Subheadline or Tagline

Body content...

---

## Section Name

Section content...
```

## Brand Guidelines

Read brand voice and product positioning from `.claude/project.config.json`:

### Voice & Tone
Read from config `marketing.voice_tone` or use defaults:
- **Confident but not arrogant**: Let features speak for themselves
- **Target audience focused**: Address the `marketing.target_audience`
- **Developer-friendly**: Technical accuracy, no BS marketing speak
- **Modern & clean**: Minimal, purposeful messaging

### Product Positioning

Use values from `.claude/project.config.json`:
- **Product Name**: `marketing.product_name`
- **Tagline**: `marketing.tagline`
- **Target Audience**: `marketing.target_audience`
- **Key Features**: Array from `marketing.key_features`
- **Differentiators**: Array from `marketing.differentiators`

Example config structure:
```json
{
  "marketing": {
    "product_name": "My Product",
    "tagline": "Your Product Tagline",
    "target_audience": "Software Development Teams",
    "key_features": [
      "Feature 1: Description",
      "Feature 2: Description"
    ],
    "differentiators": [
      "What makes you unique",
      "Your competitive advantage"
    ]
  }
}
```

## Content Templates

### Hero Section Template

Use product details from config:

```markdown
---
section: hero
---

# {marketing.tagline}

**{marketing.product_name} for {marketing.target_audience}**

{First key feature or value proposition from marketing.key_features}

[Get Started](cta-primary) | [Learn More](cta-secondary)

*{Call to action based on product type}*
```

### Stats Section Template

Customize metrics based on your product from `marketing.key_features` and `marketing.differentiators`:

```markdown
---
section: stats
---

| Metric | Value |
|--------|-------|
| {Metric from features} | {Value} |
| {Another metric} | {Value} |
```

### Feature Card Template

```markdown
---
section: feature
icon: shield
---

## Enterprise Security

SOC 2 compliant. Your code never leaves your infrastructure. Complete audit trails.
```

### CTA Section Template

```markdown
---
section: cta
style: primary
---

# Ready to Ship Faster?

Join teams using Enkai to turn GitHub issues into production-ready features in minutes, not days.

[Start Free Trial](cta-primary) | [Schedule Demo](cta-secondary)
```

## Copy Guidelines

### Headlines
- Action-oriented ("Ship Features Faster")
- Benefit-focused ("Save 60% on AI Costs")
- Clear and concise (5-8 words)

### Body Copy
- Lead with benefits, follow with features
- Use concrete numbers when possible
- Address pain points directly
- Avoid jargon and buzzwords

### CTAs
- Primary: "Get Started", "Start Building", "Start Free Trial"
- Secondary: "Watch Demo", "Learn More"
- Enterprise: "Contact Sales", "Book a Demo"

## Example Content Blocks

### Example Content Sections

Create sections based on your product's `marketing.differentiators`:

```markdown
## {First Differentiator Title}

{Detailed explanation of what makes this unique}

**Key Features:**
{Bullet points from related marketing.key_features}
```

```markdown
## {Second Differentiator Title}

{Explanation of the benefit and how it works}

**The Result:** {Quantifiable benefit if available}

| Aspect | Details |
|--------|---------|
| {Aspect 1} | {Description} |
| {Aspect 2} | {Description} |
```

```markdown
## {Feature Category from key_features}

{Description of the feature category}

### {Specific Feature}
{Details about the specific feature}

### {Another Feature}
{More details}

*... and more based on your marketing.key_features array*
```

## Instructions for AI

When executing this skill:

1. **Read config first**: Load `.claude/project.config.json` and extract all `marketing.*` values
2. **Understand the request**: Which content needs to be created?
3. **Use config values**: All product references should use `marketing.product_name`, tagline, etc.
4. **Follow brand guidelines**: Use the voice and tone appropriate for `marketing.target_audience`
5. **Output markdown files**: Write to `docs/marketing/` directory (or path from `paths.docs_root`)
6. **Use frontmatter**: Include title, description, and section metadata
7. **Structure for reuse**: Create modular sections that can be composed
8. **Feature the differentiators**: Highlight items from `marketing.differentiators` array
9. **Include key features**: Expand on items from `marketing.key_features` array
10. **Include CTAs**: Every section should have clear calls to action
11. **Use tables and lists**: Make content scannable
12. **Add concrete numbers**: Use specifics from the config when available

## File Naming Conventions

- Use kebab-case: `landing-page.md`, `maintenance-agents.md`
- Prefix sections with category: `sections/hero.md`, `sections/stats.md`
- Use descriptive names: `enterprise-security.md` not `page-3.md`
