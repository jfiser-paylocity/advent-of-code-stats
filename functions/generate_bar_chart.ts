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
    const chart_background = "#111E28";
    const primary_color = "#fc3e21";
    const grid_color = "rgba(255, 255, 255, 0.1)";
    const chart_config = `{
      type: 'bar',
      data: {
        labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, "", ""],
        datasets: [
          {
            label: 'Silver stars',
            data: [${inputs.stats.daily_silver_stars}],
            backgroundColor: 'silver',
            borderWidth: 0,
            barPercentage: 0.8,
            datalabels: {
              color: 'silver'
            }
          },
          {
            label: 'Gold stars',
            data: [${inputs.stats.daily_gold_stars}],
            backgroundColor: 'gold',
            borderWidth: 0,
            barPercentage: 0.8,
            datalabels: {
              color: 'gold'
            }
          }
        ]
      },
      options: {
        layout: { padding: { left: 0, right: 10, top: 0, bottom: 5 } },
        title: {
          display: true,
          text: 'Daily star progress',
          fontSize: 20,
          fontColor: '${primary_color}'
        },
        plugins: {
          datalabels: {
            anchor: 'end',
            align: 'top',
            rotation: -90,
            formatter: <formatter_function>,
            font: { size: 8 }
          }
        },
        scales: {
          yAxes: [{
            ticks: { 
              min: 0, 
              max: 100
            },
            gridLines: {
              color: '${grid_color}',
              borderDash: [6, 3],
              lineWidth: 0.7,
              zeroLineColor: '${grid_color}'
            }
          }],
          xAxes: [{
            gridLines: {
              display: false
            }
          }]
        },
        annotation: {
          annotations: [{
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y-axis-0',
            value: ${inputs.stats.progress},
            borderColor: '${primary_color}',
            label: {
              enabled: true,
              position: 'right',
              fontColor: '${primary_color}',
              fontSize: 8,
              backgroundColor: '${chart_background}',
              content: '${inputs.stats.progress + "%"}',
              xAdjust: -5
            }
          }]
        },
        legend: {
          labels: {
            fontColor: 'white'
          }
        }
      }
    }`;
    const chart_config_minify = chart_config
      .replace(/\n\s+/g, '')
      .replace(/,\s+/g, ',')
      .replace(/{\s+/g, '{')
      .replace(/\s+}/g, '}')
      .replace(/:\s+/g, ':')
      .replace('<formatter_function>', 'function(value, context){ return value > 0 ? value+"%" : "" }');

    const chart_config_encoded = encodeURIComponent(chart_config_minify);
    const chart_background_encoded = encodeURIComponent(chart_background);
    const endpoint = `https://quickchart.io/chart?w=740&h=270&v=2&f=png&bkg=${chart_background_encoded}&c=${chart_config_encoded}`;

    return { outputs: { chart_url: endpoint }};
  },
);