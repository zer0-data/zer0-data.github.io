# Aryan Sood — Portfolio

Personal research portfolio, built with Jekyll and deployed via GitHub Pages.

- **Live site:** [https://zer0-data.github.io](https://zer0-data.github.io)

## Updating content

All content lives in YAML files under `_data/`, so you don't need to touch HTML to update the site:

| File | Drives |
| --- | --- |
| `_data/publications.yml` | Publications page + home page publication list |
| `_data/experience.yml` | Experience page + home page timeline |
| `_data/projects.yml` | Projects page + home page gallery (`featured: true`) |
| `_data/news.yml` | "Recently" feed on the home page |
| `_config.yml` | Name, email, phone, location, nav, social links |

Each file has a comment block at the top that explains its fields.

### Filling in a placeholder

Publications and experience entries marked `placeholder: true` render as "Forthcoming" cards.
To publish one, fill in the real fields (title, venue, links, bullets, …) and delete the
`placeholder: true` line. Delete the whole entry to remove a placeholder.

## Structure

```
_layouts/default.html   page shell: nav, page-transition curtain, cursor, footer
_includes/              pub-card, pub-row, exp-item, project-card partials
assets/css/style.css    all styles (light/dark tokens at the top)
assets/js/main.js       interactions: attention-field canvas, scroll effects, filters, BibTeX copy
```

## Local development

```bash
bundle exec jekyll serve
```

(Requires Ruby + the `github-pages` gem.) Motion respects `prefers-reduced-motion`, and all
content stays readable with JavaScript disabled.
