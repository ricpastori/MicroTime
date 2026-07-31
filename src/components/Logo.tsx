export function Logo() {
  return (
    <div className="logo" role="img" aria-label="MicroTime">
      <span className="logo-mark">
        <img
          className="logo-mark__light"
          src="/microtime-logo-light.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          className="logo-mark__dark"
          src="/microtime-logo-dark.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </span>
    </div>
  );
}
