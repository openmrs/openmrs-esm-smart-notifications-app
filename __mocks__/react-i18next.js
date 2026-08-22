// Minimal stand-in for react-i18next. `t` returns the English default (or the
// key) and interpolates `{{placeholders}}` from the options object, so tests
// assert on the strings users actually see rather than on raw templates.
const interpolate = (template, options) =>
  String(template).replace(/{{\s*(\w+)\s*}}/g, (match, name) =>
    options && Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : match,
  );

const t = (key, defaultValueOrOptions, maybeOptions) => {
  const hasDefaultValue = typeof defaultValueOrOptions === 'string';
  const template = hasDefaultValue ? defaultValueOrOptions : key;
  const options = hasDefaultValue ? maybeOptions : defaultValueOrOptions;

  return interpolate(template, options);
};

module.exports = {
  useTranslation: () => ({
    t,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  }),
  Trans: ({ children }) => children,
};
