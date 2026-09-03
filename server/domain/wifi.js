function escapeWifiQrValue(value) {
  return String(value ?? '').replace(/([\\;,:\"])/g, '\\$1');
}

function wifiQrPayload(network) {
  return `WIFI:T:WPA;S:${escapeWifiQrValue(network.nome)};P:${escapeWifiQrValue(network.senha)};;`;
}

module.exports = { escapeWifiQrValue, wifiQrPayload };
