Create a widgets directory
Create a TimeLineBar, DonutChart and InkGauge component in the widgets directory. They all get a widget_config and a data_table as function params.

# TimeLineBar

```json
"widget_config": {
    "title_field": "name",
    "group_field": "resource_uid",
    "offset_field":   "offset_seconds",
    "duration_field": "duration_seconds",
    "color_field":    "state.color"
}
```

There is code in the ProductionLinePage.tsx for creating a timelinebar svg. The data you now get is better. The total_seconds you should calculate. The svg should 100% width of the parent.  

offset_seconds → x position (offset / total_seconds)
duration_seconds → width (duration / total_seconds)
state → color/label from the lookup JSON.

All the functionality, so also the hover etc and the multiple timelinebars should be exactly the same as in the current ProductionLinesPage. 

Remove the code for the timeline from the ProductionLinesPage.tsx

# DonutChart

```json
"widget_config": {
    "filter_field": "type",
    "group_field":       "state,code",
    "code_field":        "state.code",
    "color_field":       "state.color",
    "aggregate_field":   "duration_seconds",
    "aggregate_fn": "sum",
    "show_legend":       true
}
```

There is code in the ProductionLinePage.tsx for creating a donutchart with legend. The data you now get is better and allready aggregated. 

All the functionality should be exactly the same as in the current ProductionLinesPage.

# InkGauge

```json
"widget_config": {
    "ink_field":            "ink",
    "level_field":          "level",
    "color_field":          "color",
    "expiration_date_field": "expiration_date",
    "level_relative_to": "total|full",
}
```

The InkGauge should show the different Ink levels. If level_relative_to is total, then its for ink-used, if expiration_date_field is empty, don't show the expiration_date. This widget is for the ink-levels in a printer or ink-used on a printed file. If the level_relative_to is 'full' then use 100% as total. 

You will get an array with ink name, color in hex to show the right color, etc. 

# sidebar

In the sidebar, all data_groups are loaded. In the data_group there is a property layout. If that property is 'ink_gauge' show the InkGauge component, same for timeline-bar and donut-chart. 

