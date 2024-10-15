const Chart = require('chart.js');

const createRadarChart = (ctx, data, width, height) => {
  // Create a gradient for the background color
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(54, 162, 235, 0.5)');
  gradient.addColorStop(1, 'rgba(54, 162, 235, 0)');

  // Set shadow properties
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Long Term Investor', 'Short Term Investor', 'Gambler', 'Winner', 'Swinger'],
      datasets: [{
        label: 'Trading Profile',
        data: data,
        backgroundColor: gradient,
        borderColor: 'rgba(0, 128, 0, 1)', // Solid green line for profit
        borderWidth: 5,  // Thicker line for bolder appearance
        pointBackgroundColor: 'rgba(255, 0, 0, 1)', // Red points
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(0, 128, 0, 1)',
        pointStyle: 'circle'
      }]
    },
    options: {
      scales: {
        r: {
          angleLines: {
            display: true,
            color: '#ccc',
            lineWidth: 3  // Thicker angle lines for bolder look
          },
          grid: {
            display: true,
            color: '#ccc',
            lineWidth: 2.5  // Thicker grid lines
          },
          ticks: {
            display: false  // Remove grid labels
          },
          pointLabels: {
            font: { size: 16, weight: 'bold' },
            color: '#fff',
            // Custom plugin to add stroke to text
            callback: (value) => {
              ctx.save();
              ctx.lineWidth = 4;  // Thickness of the stroke
              ctx.strokeStyle = '#000';  // Stroke color (black)
              ctx.strokeText(value, 0, 0);  // Stroke the text first
              ctx.fillStyle = '#fff';  // Fill color (white)
              ctx.fillText(value, 0, 0);  // Fill the text
              ctx.restore();
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            font: {
              size: 16,
              family: 'Roboto',
              weight: 'bold'
            },
            color: '#fff',  // White font for legend
            // Applying stroke for legend text
            generateLabels: function (chart) {
              const originalLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              originalLabels.forEach((label) => {
                ctx.save();
                ctx.lineWidth = 4;  // Stroke thickness
                ctx.strokeStyle = '#000';  // Black stroke
                ctx.strokeText(label.text, 0, 0);
                ctx.fillStyle = '#fff';  // White fill
                ctx.fillText(label.text, 0, 0);
                ctx.restore();
              });
              return originalLabels;
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: { family: 'Roboto', size: 14 },
          bodyFont: { family: 'Roboto', size: 12 },
          bodyColor: '#ffffff',
          borderColor: '#333',
          borderWidth: 1
        }
      },
      elements: {
        line: { borderWidth: 5 }  // Thicker radar lines for bold appearance
      }
    }
  });
};
