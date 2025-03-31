# Docling Components

Web components for displaying Docling output, which simplifies document processing, parsing diverse formats — including advanced PDF understanding. This package requires the JSON output of documents that are converted by [Docling](https://docling.io). Get started with the [interactive examples](https://docling-project.github.io/docling-ts/examples).

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

#### Plain use
Similar to `<img>` you can point the component to the Docling JSON file.

```html
<docling-img src="conversion.json" />
```

Or load the document programmatically:

```html
<script type="module">
  const cmp = document.getElementById("cmp");

  const fetched = await fetch("conversion.json")
  const doc = await fetched.json();
  cmp.src = doc;
</script>
...
<docling-img id="cmp" pagenumbers />
```


#### Item filter and highlight

Narrow down the marked document items according to their reference path in the converted document:

```html
<docling-img src="conversion.json" items="#/pictures/3" />
```

Select entire item categories with `items="#/pictures"`, full pages with `items="#/pages/2"`, and unions with `items="#/pictures, #/tables"`.

Or select specific items programmatically:
```html
<script type="module">
    const cmp = document.getElementById("cmp");
    const fetched = await fetch("conversion.json")
    const doc = await fetched.json();
    cmp.src = doc;

    // Select the first three tables.
    cmp.items = doc.tables.slice(0, 3);
</script>
...
<docling-img id="cmp" pagenumbers />
```

To emphasize item selections, you can suppress the non-selection into a page backdrop and/or trim out the pages without any selected items:

```html
<docling-img src="conversion.json" items="#/pictures" trim="pages" backdrop />
```

#### Tooltips
Overlay a tooltip when you hover a parsed item on a page, showing its contents:
```html
<docling-img src="conversion.json" tooltip="parsed" />
```

### docling-table

This component displays the converted document as a table of parsed document items, with columns for item contents and an image from the rendered document (if available).

#### Plain use

```html
<docling-table src="conversion.json" />
```

You can select items with the `items` attributes, as described for the `docling-img` component. Selecting items will trim all non-selected items from view.

#### Configure columns
Select the columns that you want to have shown and in what order:
```html
<docling-table src="conversion.json" columns="parsed,image" />
```

You can use this to display the cropped image of a single document item as well:
```html
<docling-table src="conversion.json" columns="image" items="#/tables/2" />
```
