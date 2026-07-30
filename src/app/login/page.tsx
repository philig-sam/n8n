export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="card" style={{ maxWidth: 380, margin: '80px auto' }}>
      <h1>Admin login</h1>
      {searchParams.error && <p style={{ color: 'var(--red)' }}>Wrong password.</p>}
      <form method="POST" action="/api/login">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoFocus required />
        <div style={{ marginTop: 16 }}>
          <button type="submit">Log in</button>
        </div>
      </form>
    </div>
  );
}
