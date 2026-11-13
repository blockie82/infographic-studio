# Infographic Studio

A self-hosted, Flourish-style tool for making animated charts. Load your data, pick a template, style it, then export either:

- **Standalone HTML**: one file with no dependencies. It plays when scrolled into view, has optional play and timeline controls, and can be hosted anywhere or embedded with an `<iframe>`.
- **MP4 video**: H.264, rendered frame by frame (not screen-recorded), so it plays smoothly whatever your computer's speed. You can choose 24, 25, 30 or 60 fps, from 720p up to 4K, in landscape, square, 4:5 or 9:16.
- **PNG**: a still of the current frame.

Everything runs in your browser. Nothing gets uploaded or installed, and you don't need an account.

## Getting started

1. Unzip the folder.
2. Double-click `index.html`. Chrome or Edge works best. Recent Firefox and Safari also work.

If your browser blocks local files, serve the folder from a terminal instead:

```bash
cd infographic-studio
python3 -m http.server 8000      # then open http://localhost:8000
```

## Templates (33)

Infographic Studio has a template for every distinct chart type in Flourish's catalogue. Where Flourish has several templates that draw the same kind of chart, they're merged here into one template with options.

In the left-hand picker you can **search**, **filter** (Quantitative, Qualitative, Over time) and **group** templates by *what they show*, by *type of data*, or A–Z.

| What it shows | Template | Data layout |
|---|---|---|
| **Comparison** | Column chart | Category, then one column per series. Options: vertical or horizontal, grouped or stacked, sorting. |
| | Waterfall chart | Step, change. Type `total` in the change column to add a subtotal. |
| | Radar chart | Measure, then one column per series. |
| | Survey results | Question, then answer columns from most negative to most positive (diverging Likert bars). |
| | Table | Any table. Number columns get inline bars or a heatmap. |
| **Change over time** | Bar chart race | Name, then one column per period. |
| | Line chart | X, then one column per series. Its *rank mode* turns it into a line chart race or bump chart. |
| | Area chart | X, then one column per series. Types: stacked, 100%, overlapping or streamgraph. |
| | Slope chart | Name, before value, after value. |
| | Calendar heatmap | Date, value. |
| **Part of a whole** | Donut / pie | Name, value. |
| | Treemap | Item, value, optional group. |
| | Sunburst | One column per hierarchy level, then a value. |
| | Packed bubbles | Name, value, optional group (circle packing). |
| | Marimekko | Category, then one column per segment. |
| | Icon chart | Category, value, optional icon. Grid or rows layout. |
| | Parliament chart | Party, seats, optional colour. |
| **Correlation** | Scatter / bubble plot | Name, period, X, Y, size, group. Bubbles move through the periods. |
| **Flows & relationships** | Sankey diagram | Source, target, value. |
| | Chord diagram | Source, target, value. |
| | Arc diagram | From, to, optional value. |
| | Network graph | From, to, optional value. Clusters are coloured automatically. |
| **Maps** | Country map | Country, then a value or category. Add more columns to animate through periods. |
| | Point map | Name, latitude, longitude, value, group. |
| **Key figures** | Big numbers | Label, number, optional icon, optional caption. |
| | Gauge | Label, value, optional min, max and target. |
| **Cards** | Content cards | Title, text, optional tag, icon and colour. Five card styles, with an icon circle, colour band or big emoji at the top. |
| | Quote carousel | Quote or fact, name, role, icon. Shows one card at a time with slide, fade or zoom transitions. |
| | Leaderboard cards | Name, value, change (e.g. +12%), icon, caption. Shows rank badges, values that count up and ▲▼ change markers. |
| | Step cards | Step title, description, icon. Numbered steps joined by arrows, running across or down. |
| **Text, events & schedules** | Word cloud | Word, weight. Or paste free text and the words are counted for you. |
| | Timeline | Date, title, optional description, optional icon. |
| | Gantt chart | Task, start date, end date, optional group. |

Each template is also tagged as **Numbers** (quantitative), **Words & links** (qualitative) or **Mixed**. Templates that play through time periods are marked **▶ over time**.

### How the Flourish templates map to these

The following Flourish templates are merged here into one template with options:

- Line, bar & pie variants (grouped, stacked, area, stream) are covered by the Column, Area and Donut templates.
- Line chart race, Sports race and Horserace are covered by the Line chart's rank mode.
- Number ticker and Countdown are covered by Big numbers. Flourish's Cards template has its own Cards group.
- Bubble chart and the circle-packing view of Hierarchy are covered by Packed bubbles.
- Election results chart is covered by the Parliament chart and Column chart.
- Survey's dot view is covered by the Icon chart. Diverging bars are the Survey template.

Some Flourish templates are interactive rather than charts, and they can't become a video, so they're left out: Quiz, Calculator, Photo slider, Audio, Draw-the-line, Interactive/annotated SVG, Text annotator and Tournament.

### Maps

The country map uses Natural Earth outlines (public domain, via the `world-atlas` package), drawn with the Equal Earth projection. It matches common names and abbreviations: UK, USA, DRC, Czech Republic, Ivory Coast, Türkiye and so on. Any name it can't match is counted in a note on the chart. The outlines are only embedded in an exported HTML file when the project is a map.

### Icons

You can use these built-in icon names: `person, heart, star, house, drop, leaf, bolt, car, tree, trophy, laptop, phone, sun, pound, globe, book, chat, check, circle, square`. Common synonyms work too, such as `people`, `home`, `water`, `energy`, `money` and `award`.

You can also type **any emoji** into the icon column (🚲 🍎 🐟 📦 …) and it will be used as the icon.

You can get data in by importing a CSV or TSV, pasting from Excel or Google Sheets, or dropping a file onto the window. You can also edit cells directly; pasting a block into a cell spreads it across the grid.

## Images

You can add your own image files (JPG, PNG, SVG, GIF, WebP) to a project:

- **Upload:** in the **Data** tab, click **+ Add images…**, or drag image files onto the window. Large photos are scaled down to 1,400 px automatically.
- **Use:** type an image's file name into the data, with or without the extension (`garden.jpg` or `garden`). Clicking an image in the strip copies its name.

| Where | How images are used |
|---|---|
| Any **Icon** column (icon chart, big numbers, timeline, step cards, table cells and so on) | An image name works anywhere an icon name or emoji does. |
| **Content cards** | The image becomes a photo across the top of the card. |
| **Quote carousel** | A large photo beside the quote, or a small round avatar. |
| **Leaderboard cards** | A round avatar or logo beside the name. |
| **Bar chart race** | Name an image after a bar (e.g. `Cobalt.png`) and it appears on that bar automatically. |
| **Every template** (settings → *Images*) | A **logo** in any corner, and a faded **background image**. |

The *Shape of images used as icons* setting crops them to a circle, rounded square or square, or keeps them uncropped.

Images are saved inside the project file and embedded in exported HTML (only the ones the chart uses), so everything still works offline. MP4 and PNG exports include them too. Images make projects larger, so if one is too big for the browser's autosave you'll see a message. In that case use **Save project** to keep it.

## Projects

- **Save project** downloads a `.infographic.json` file containing the data, template, size and settings. **Open…** (or drag and drop) loads one back.
- Your current work is also autosaved in the browser, so it comes back after a page refresh.

## Styling

Every template shares these options:
- Title, subtitle and source note
- Colour palettes, plus custom colours per item (`Cobalt: #ff9900`, one per line)
- Background and text colours, font and text size
- Number prefix and suffix, decimal places, compact numbers (1.2k, 3.4M)
- Animation length, how long to hold the final frame, and easing

Each template also has its own options, such as bars shown, line smoothing or hole size.

## How it works

```
index.html          Editor UI
css/app.css         Editor styles
js/runtime.js       Chart engine: all templates, drawing, playback (no dependencies)
js/exporters.js     HTML / MP4 / PNG export
js/app.js           Editor logic (settings panel, data grid, files)
js/samples.js       Sample projects (invented data)
js/csv.js           CSV parser
vendor/mp4-muxer.js MP4 container writer (MIT licence)
vendor/world.js     World country outlines for the map templates
```

- **One renderer for everything.** `Infographic.draw(ctx, width, height, project, timeInSeconds)` paints a single frame onto a canvas, and its output depends only on the time you pass in. The preview, the HTML export and the MP4 export all use this same call, so what you see in the editor matches the exports.
- **HTML export** copies the source of `InfographicRuntime` into the file along with your project JSON. That's why the exported file needs nothing else.
- **MP4 export** draws every frame to an offscreen canvas, encodes it with the browser's WebCodecs `VideoEncoder` (H.264) and packages the result with `mp4-muxer`. Browsers without WebCodecs fall back to real-time recording with `MediaRecorder`, which may produce WebM.

## Adding a template

Add an entry to `TEMPLATES` in `js/runtime.js`:

```js
TEMPLATES.myChart = {
  name: 'My chart',
  description: 'One-line description',
  dataHint: 'How the data should be laid out',
  settings: [ { group: 'My chart', key: 'thing', label: 'Thing', type: 'checkbox', def: true } ],
  draw: function (C, R) {
    // C.ctx canvas, C.S settings, C.T data rows, C.u size unit,
    // C.pLinear / C.pEased progress 0→1. R = {x,y,w,h} plot area.
  }
};
```

Then add a matching sample in `js/samples.js`, and give the template a line in `META` (near the end of `runtime.js`) so the picker knows its category, its data type and whether it animates over time. The settings panel, thumbnail and every exporter pick up the new template automatically.

## Ideas for next steps

- UK regions and local authority maps
- A "story" mode that moves between several charts
- Exporting audio narration or background music into the MP4
- A Node or Puppeteer CLI for batch-rendering videos on a server
