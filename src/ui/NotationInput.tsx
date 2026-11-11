interface Props {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (text: string) => void;
}

/** Text field for mpsz notation; the parent keeps it in sync with the tiles. */
export function NotationInput({ id, label, value, placeholder, error, onChange }: Props) {
  return (
    <div className="notation">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
