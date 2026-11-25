import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardStatsCustomType } from "../types/leaderboard_stats.ts";

export const GenerateBarChartFunctionDefinition = DefineFunction({
  callback_id: "generate_bar_chart",
  title: "Generate a chart",
  source_file: "functions/generate_bar_chart.ts",
  input_parameters: {
    properties: {
      stats: {
        type: LeaderboardStatsCustomType,
        description: "Leaderboard statistics",
      },
    },
    required: ["stats"],
  },
  output_parameters: {
    properties: {
      chart_url: {
        type: Schema.types.string,
        description: "Generated bar chart image url",
      },
    },
    required: ["chart_url"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  GenerateBarChartFunctionDefinition,
  ({ inputs }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    const { stats } = inputs;
    const total_days = stats.daily_gold_stars.length;
    const days_released = stats.days_released ?? total_days;
    const year = stats.year ?? new Date().getFullYear();

    // Colors taken from adventofcode.com stylesheet
    const chart_background = "#0f0f23";
    const text_color = "#cccccc";
    const grid_color = "#333340";
    const title_color = "#00cc00";
    const silver_color = "#9999cc";
    const gold_color = "#ffff66";
    const average_color = "#ff0000";

    // Days that are not released yet have no bars. The trailing empty slot
    // keeps the average label from overlapping the last day's bars.
    const to_series = (values: number[]) => [
      ...values.map((value, index) => (index < days_released ? +value : null)),
      null,
    ];
    const labels = [...Array.from({ length: total_days }, (_, i) => i + 1), ""];

    const subtitle =
      (stats.total_participants
        ? `${stats.total_participants} participants · `
        : "") +
      `${days_released} of ${total_days} days released · % of participants`;

    const dataset_style =
      "borderWidth:0,barPercentage:0.85,categoryPercentage:0.85";
    const chart_config = `{
      type:'bar',
      data:{
        labels:${JSON.stringify(labels)},
        datasets:[
          {label:'Part 1 (silver)',data:${
      JSON.stringify(to_series(stats.daily_silver_stars))
    },backgroundColor:'${silver_color}',${dataset_style},datalabels:{color:'${silver_color}'}},
          {label:'Part 2 (gold)',data:${
      JSON.stringify(to_series(stats.daily_gold_stars))
    },backgroundColor:'${gold_color}',${dataset_style},datalabels:{color:'${gold_color}'}},
          {type:'line',label:'   ${subtitle}',data:[],backgroundColor:'rgba(0,0,0,0)',borderColor:'rgba(0,0,0,0)',borderWidth:0,datalabels:{display:false}}
        ]
      },
      options:{
        layout:{padding:{left:5,right:15,top:5,bottom:5}},
        title:{display:true,text:'Advent of Code ${year} · daily star progress',fontSize:22,fontColor:'${title_color}'},
        legend:{labels:{fontColor:'${text_color}',fontSize:13}},
        plugins:{datalabels:{anchor:'end',align:'top',font:{size:12,weight:'bold'},formatter:<label_formatter>}},
        scales:{
          yAxes:[{ticks:{min:0,max:100,stepSize:20,fontColor:'${text_color}',fontSize:13,callback:<tick_formatter>},gridLines:{color:'${grid_color}',borderDash:[4,4],zeroLineColor:'${grid_color}'}}],
          xAxes:[{scaleLabel:{display:true,labelString:'Day (December)',fontColor:'${text_color}',fontSize:13},ticks:{fontColor:'${text_color}',fontSize:13},gridLines:{display:false}}]
        },
        annotation:{annotations:[{type:'line',mode:'horizontal',scaleID:'y-axis-0',value:${stats.progress},borderColor:'${average_color}',borderWidth:2,borderDash:[8,4],label:{enabled:true,position:'right',content:'${stats.progress}%',fontColor:'#ffffff',backgroundColor:'${average_color}',fontSize:12,yAdjust:-14}}]}
      }
    }`;
    // Keep the URL short (Slack limits image_url to 3000 characters)
    const chart_config_minify = chart_config
      .replace(/\n\s+/g, "")
      .replace(
        "<label_formatter>",
        "function(v){return v==null?'':v+'%'}",
      )
      .replace("<tick_formatter>", "function(v){return v+'%'}");

    const chart_config_encoded = encodeURIComponent(chart_config_minify);
    const chart_background_encoded = encodeURIComponent(chart_background);
    const endpoint =
      `https://quickchart.io/chart?w=900&h=420&v=2&f=png&devicePixelRatio=2&bkg=${chart_background_encoded}&c=${chart_config_encoded}`;

    return { outputs: { chart_url: endpoint } };
  },
);
