module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: ['http://127.0.0.1:3000/', 'http://127.0.0.1:3000/products/sample-product', 'http://127.0.0.1:3000/categories/sample-category']
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }]
      }
    }
  }
};
