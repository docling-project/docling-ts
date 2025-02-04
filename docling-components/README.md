# Docling Components

Web components for displaying Docling output, which simplifies document processing, parsing diverse formats — including advanced PDF understanding. This package requires the JSON output of documents that are converted by [Docling](https://ds4sd.github.io/docling).

## Install package

In case of a client or single page application that is bundled upfront:

```sh
npm i @docling/docling-components
```

Next, import the package at the application root to install the components:

```ts
import '@docling/docling-components';
```

In case of a static or server-side rendered website; add the package to the page HTML.
Either download the package and serve it as part of the rest of the website, or use a CDN mirror of NPM:

```html
<html>
  <head>
    ...

    <script type="module" src="https://unpkg.com/@docling/docling-components" />
  </head>

  ...
</html>
```

## Components

### docling-img

This component displays the converted document in context of its original form, by showing the full page renderings that are embedded in the conversion JSON (for specific input document formats). Each document item is shown as a bounding box on top of the page.

Plain use:

```html
<docling-img src="conversion.json" />
```

You can narrow down the marked document items according to their reference path in the converted document:

```html
<docling-img src="conversion.json" items="#/pictures/3" />
```

Select entire item categories with `items="#/pictures"`, full pages with `items="#/pages/2"`, and unions with `items="#/pictures, #/tables"`.

To emphasize or summarize these selections, you can suppress the non-selection into a page backdrop and/or trim out the pages without any selected items:

```html
<docling-img src="conversion.json" items="#/pictures" trim="pages" backdrop />
```

### docling-list

This component displays the converted document as a vertical list of detected document items, with the parsed item contents on one side and a cropped provenance image on the other side (if available).

Plain use:

```html
<docling-list src="conversion.json" />
```

You can select items with the `items` attributes, as described for the `docling-img` component. Selecting items will hide all non-selected items from view.
