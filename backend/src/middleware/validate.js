export function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = await schema.parseAsync(dataToValidate);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        const errorMap = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMap
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid input data'
      });
    }
  };
}
