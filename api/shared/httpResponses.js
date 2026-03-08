function sendJson(context, status, body) {
  context.res = {
    status,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  };
}

function handleEndpointError(context, error) {
  context.log.error(error);
  sendJson(context, 500, {
    error: "Dashboard API request failed.",
    details: error.message,
  });
}

module.exports = {
  handleEndpointError,
  sendJson,
};
