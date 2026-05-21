import "./PageLoader.css";

export default function PageLoader({ text = "Yükleniyor..." }: { text?: string }) {
  return (
    <div className="page-loader">
      <p className="page-loader__text">{text}</p>
    </div>
  );
}
