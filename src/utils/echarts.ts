import { LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { init, type EChartsType, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { init, type EChartsType };
