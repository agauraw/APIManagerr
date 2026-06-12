/**
 * External Plugin — renderer.js
 *
 * This file is loaded at runtime via a blob URL.
 * It must be a self-executing IIFE that:
 *   1. Reads its dependencies from window.__pluginAPI
 *   2. Sets window.__pluginDef to the plugin definition object
 *
 * Available via window.__pluginAPI:
 *   - React        : the React library (createElement, useState, useEffect, …)
 *   - ipc          : window.electronAPI (IPC bridge to main process)
 *
 * To install: copy this folder into your userData/plugins/ directory and restart the app.
 */
(function () {
  var _ref = window.__pluginAPI;
  var React = _ref.React;
  var ipc = _ref.ipc;

  var createElement = React.createElement;
  var useState = React.useState;

  function ExampleSidebar() {
    var state = useState(0);
    var count = state[0];
    var setCount = state[1];

    return createElement(
      'div',
      { style: { padding: '12px', color: '#d1d5db', fontSize: '12px' } },
      createElement(
        'div',
        { style: { fontWeight: '600', color: '#f3f4f6', marginBottom: '8px' } },
        '🔌 Example Plugin'
      ),
      createElement(
        'p',
        { style: { color: '#6b7280', lineHeight: '1.5', marginBottom: '12px' } },
        'This is an external plugin loaded from the plugins directory. It demonstrates the plugin API.'
      ),
      createElement(
        'div',
        { style: { background: 'rgba(255,108,55,0.1)', border: '1px solid rgba(255,108,55,0.3)', borderRadius: '6px', padding: '10px', textAlign: 'center' } },
        createElement(
          'div',
          { style: { fontSize: '24px', fontWeight: 'bold', color: '#ff6c37', marginBottom: '6px' } },
          count
        ),
        createElement(
          'button',
          {
            onClick: function () { setCount(function (n) { return n + 1; }); },
            style: {
              background: '#ff6c37', color: 'white', border: 'none',
              borderRadius: '4px', padding: '4px 12px', fontSize: '11px',
              cursor: 'pointer', fontWeight: '600',
            },
          },
          'Click me'
        )
      )
    );
  }

  window.__pluginDef = {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    icon: '🔌',
    description: 'A minimal example showing how to build an external plugin with a custom sidebar tab.',

    sidebarTab: {
      label: 'Example',
      order: 20,
      component: ExampleSidebar,
    },
  };
})();
