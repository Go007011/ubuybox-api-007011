module.exports = async function (context, req) {
  context.res = {
    status: 200,
    body: {
      service: "UBUYBOX API",
      status: "running"
    }
  };
};