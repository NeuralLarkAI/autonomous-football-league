export default function Custom404() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0f1e",
        color: "#e2e8f0",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
          404
        </h1>
        <p style={{ color: "#94a3b8" }}>Page not found.</p>
        <a
          href="/"
          style={{
            color: "#38bdf8",
            textDecoration: "underline",
            display: "inline-block",
            marginTop: "1rem",
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
