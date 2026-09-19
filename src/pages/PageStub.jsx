export default function PageStub({ name }) {
  return (
    <div style={{ paddingTop: '120px', paddingBottom: '120px', maxWidth: '600px' }}>
      <h2>{name}</h2>
      <p style={{ color: 'var(--font-cold-color)' }}>
        This page hasn&apos;t been ported to React yet. The original vanilla-JS
        version lives in <code>legacy/pages/{name.toLowerCase()}.html</code> and{' '}
        <code>legacy/js/{name.toLowerCase()}.js</code> for reference.
      </p>
    </div>
  );
}
