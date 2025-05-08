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

    <script type="module" src="http://0.0.0.0:8000/node_modules/@docling/docling-components/dist/index.es.js" />
  </head>

  ...
</html>
```

## Document components

### docling-img

This component displays the converted document in context of its original form, by showing the full page renderings that are embedded in the conversion JSON (for specific input document formats). Each document item is shown as a bounding box on top of the page.

#### Plain use

Similar to `<img>` you can point the component to the Docling JSON file.

```html
<docling-img src="conversion.json"></docling-img>
```

Or load the document programmatically:

```html
<script type="module">
  const cmp = document.getElementById('cmp');

  const fetched = await fetch('conversion.json');
  const doc = await fetched.json();
  cmp.src = doc;
</script>
...
<docling-img id="cmp" pagenumbers></docling-img>
```

#### Item filter and highlight

Narrow down the marked document items according to their reference path in the converted document:

```html
<docling-img src="conversion.json" items="#/pictures/3"></docling-img>
```

Select entire item categories with `items="#/pictures"`, full pages with `items="#/pages/2"`, and unions with `items="#/pictures, #/tables"`.

Or select specific items programmatically:

```html
<script type="module">
  const cmp = document.getElementById('cmp');
  const fetched = await fetch('conversion.json');
  const doc = await fetched.json();
  cmp.src = doc;

  // Select the first three tables.
  cmp.items = doc.tables.slice(0, 3);
</script>
...
<docling-img id="cmp" pagenumbers></docling-img>
```

To emphasize item selections, you can suppress the non-selection into a page backdrop and/or trim out the pages without any selected items:

```html
<docling-img
  src="conversion.json"
  items="#/pictures"
  trim="pages"
  backdrop
></docling-img>
```

#### Tooltip

Pops up a tooltip besides an item when you hover it on a page. This tooltip shows the item's parsed content and annotations if matching web components are available:

```html
<docling-img src="conversion.json">
  <docling-tooltip></docling-tooltip>
</docling-img>
```

#### Overlay

Overlays parsed content and annotations directly on top of items (potentially occluding them).

```html
<docling-img src="conversion.json">
  <docling-overlay></docling-overlay>
</docling-img>
```

### docling-table

This component displays the converted document as a table of parsed document items, with columns for item contents and an image from the rendered document (if available).

#### Plain use

```html
<docling-table src="conversion.json"></docling-table>
```

You can select items with the `items` attributes, as described for the `docling-img` component. Selecting items will trim all non-selected items from view.

#### Configure columns

Select the columns that you want to have shown and in what order:

```html
<docling-table src="conversion.json">
  <docling-column>
    <docling-item-text></docling-item-text>
    <docling-item-table></docling-item-table>
  </docling-column>
  <docling-column>
    <docling-item-provenance></docling-item-provenance>
  </docling-column>
</docling-table>
```

You can use this to display the cropped image of a single document item as well:

```html
<docling-table
  src="conversion.json"
  items="#/tables/2"
>
  <docling-column>
    <docling-item-provenance></docling-item-provenance>
  </docling-column>
</docling-table>
```

## Item components
Most types of document item have a prepackaged component that will be used to visualize it:
| Tag        | Item label |
| ---------- | ---------- |
| `<docling-item-text>` | checkbox_selected<br /> checkbox_unselected<br /> footnote<br /> page_footer<br /> page_header<br /> paragraph<br /> text<br /> reference |
| `<docling-item-table>` | table |

You can use these tags directly with elements like `<docling-tooltip>` to specify what components will be used, including optional parameters. For example, to exclusively show tooltips for table components:
```
<docling-tooltip>
  <docling-item-table></docling-item-table>
</docling-tooltip>
```

You can create your own item components by extending from the `DoclingItemElement` class at `/src/item/ItemElement.ts` and annotating the class with `@customDoclingItemElement('docling-my-first-item-component')` to have it registered as both a custom web element and as a default component for rendering document items.

## Annotation components
Some types of document item annotation have a prepackaged component that will be used to visualize it:
| Tag        | Item label | Annotation kind |
| ---------- | ---------- | --------------- |
| `<docling-picture-classification>` | chart <br /> picture | classification |
| `<docling-picture-description>` | chart <br /> picture | description  |

You can use these tags directly with elements like `<docling-tooltip>` to specify what components will be used. For example, to overlay pictures with their classification, if any:
```
<docling-overlay>
  <docling-picture-classification></docling-picture-classification>
</docling-overlay>
```

You can create your own annotation components by extending from the `DoclingAnnotationElement` class at `/src/annotation/AnnotationElement.ts` and annotating the class with `@customDoclingAnnotationElement('docling-my-first-annotation-component')` to have it registered as both a custom web element and as a default component for rendering document annotations.
