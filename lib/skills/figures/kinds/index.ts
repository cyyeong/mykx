// One renderer per figure kind found in the skill packs' figure_spec data.
import type { Renderer } from "../svg.ts";
import { barChart, barGraph } from "./bar-graph.ts";
import { beakers } from "./beakers.ts";
import { bowlTest } from "./bowl-test.ts";
import { circuit } from "./circuit.ts";
import { compass } from "./compass.ts";
import { container } from "./container.ts";
import { electromagnet } from "./electromagnet.ts";
import { flexTest } from "./flex-test.ts";
import { floatTank } from "./float-tank.ts";
import { flower } from "./flower.ts";
import { flowchart } from "./flowchart.ts";
import { foodWeb } from "./food-web.ts";
import { germination } from "./germination.ts";
import { icon } from "./icon.ts";
import { iconSet } from "./icon-set.ts";
import { lifeCycle } from "./life-cycle.ts";
import { lightTest } from "./light-test.ts";
import { lineGraph } from "./line-graph.ts";
import { magnetDistance } from "./magnet-distance.ts";
import { magnetLayout } from "./magnet-layout.ts";
import { magnets } from "./magnets.ts";
import { magnetsTable } from "./magnets-table.ts";
import { picture } from "./picture.ts";
import { poster } from "./poster.ts";
import { ringStack } from "./ring-stack.ts";
import { row } from "./row.ts";
import { scene } from "./scene.ts";
import { springSet } from "./spring-set.ts";
import { strengthTest } from "./strength-test.ts";
import { stroke } from "./stroke.ts";
import { tree } from "./tree.ts";

export const KINDS: Record<string, Renderer> = {
  bar_chart: barChart,
  bar_graph: barGraph,
  beakers,
  bowl_test: bowlTest,
  circuit,
  compass,
  container,
  electromagnet,
  flex_test: flexTest,
  float_tank: floatTank,
  flower,
  flowchart,
  food_web: foodWeb,
  germination,
  icon,
  icon_set: iconSet,
  life_cycle: lifeCycle,
  light_test: lightTest,
  line_graph: lineGraph,
  magnet_distance: magnetDistance,
  magnet_layout: magnetLayout,
  magnets,
  magnets_table: magnetsTable,
  picture,
  poster,
  ring_stack: ringStack,
  row,
  scene,
  spring_set: springSet,
  strength_test: strengthTest,
  stroke,
  tree,
};
