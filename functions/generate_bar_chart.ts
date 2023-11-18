import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const GenerateBarChartFunctionDefinition = DefineFunction({
  callback_id: "generate_bar_chart",
  title: "Generate a chart",
  source_file: "functions/generate_bar_chart.ts",
  input_parameters: {
    properties: {
      stats: {
        type: Schema.types.object,
        description: "Leaderboard statistics",
      },
    },
    required: ["stats"],
  },
  output_parameters: {
    properties: {
      chart: {
        type: Schema.types.object,
        description: "Generate bar chart image",
      },
    },
    required: ["chart"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  GenerateBarChartFunctionDefinition,
  async ({ inputs }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    const chart_background = "#111E28";
    const primary_color = "#fc3e21";
    const grid_color = "rgba(255, 255, 255, 0.1)";
    const chart_config = `{
      type: 'bar',
      data: {
        labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, ""],
        datasets: [
          {
            label: 'Silver stars',
            data: [${inputs.daily_silver_stars}],
            backgroundColor: 'silver',
            borderWidth: 0,
            barPercentage: 0.8,
            datalabels: {
              color: 'silver'
            }
          },
          {
            label: 'Gold stars',
            data: [${inputs.daily_gold_stars}],
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
            formatter: function(value, context) { return value > 0 ? value + "%" : ""; },
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
            value: ${inputs.progress},
            borderColor: '${primary_color}',
            label: {
              enabled: true,
              position: 'right',
              fontColor: '${primary_color}',
              fontSize: 8,
              backgroundColor: '${chart_background}',
              content: '${inputs.progress + "%"}',
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

    try {
      const endpoint = "https://quickchart.io/chart";
      const body = JSON.stringify({
        version: "2",
        backgroundColor: chart_background,
        width: 740,
        height: 270,
        devicePixelRatio: 3.0,
        format: "png",
        chart: chart_config
      });
      const headers = { "Content-Type": "application/json" };
      const response = await fetch(endpoint, { 
        method: "POST", 
        body: body, 
        headers: headers 
      });
      if (response.status != 200) {
        // In the case where the API responded with non 200 status
        const body = await response.text();
        const error =
          `Failed to call AoC API (status: ${response.status}, body: ${body})`;
        throw { error };
      };
      const chart_image = await response.arrayBuffer();
      return { outputs: { chart: { image: chart_image } } };
    } catch (err) {
      const error = "Failed to call AoC API";
      console.log(err);
      throw { error };
    };
  },
);