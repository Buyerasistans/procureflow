import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./SocialRegisterLayout.css";

interface Feature {
  text: string;
}

interface Props {
  brandGradient: string;
  brandTitle: string;
  brandSubtitle: string;
  brandFeatures: Feature[];
  formTitle: string;
  formSubtitle: string;
  children: ReactNode;
}

export default function SocialRegisterLayout({
  brandGradient,
  brandTitle,
  brandSubtitle,
  brandFeatures,
  formTitle,
  formSubtitle,
  children,
}: Props) {
  return (
    <div className="srl-root">
      <div className="srl-brand" style={{ background: brandGradient }}>
        <div className="srl-brand__inner">
          <Link to="/" className="srl-brand__logo">
            <img
              src="/brand/buyer-amblem.svg"
              alt="Buyer Asistans"
              className="srl-brand__logo-img"
            />
            <span className="srl-brand__logo-name">BUYER ASISTANS</span>
          </Link>
          <div className="srl-brand__content">
            <h1 className="srl-brand__title">{brandTitle}</h1>
            <p className="srl-brand__subtitle">{brandSubtitle}</p>
            <ul className="srl-brand__features">
              {brandFeatures.map((f, i) => (
                <li key={i} className="srl-brand__feature">
                  <span className="srl-brand__feature-check" aria-hidden="true" />
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="srl-brand__footer">buyerasistans.com.tr</p>
        </div>
      </div>

      <div className="srl-form-panel">
        <div className="srl-form-panel__inner">
          <Link to="/" className="srl-mobile-logo">
            <img src="/brand/buyer-amblem.svg" alt="Buyer Asistans" width="28" height="28" />
            <span>BUYER ASISTANS</span>
          </Link>
          <div className="srl-form-panel__header">
            <h2 className="srl-form-panel__title">{formTitle}</h2>
            <p className="srl-form-panel__subtitle">{formSubtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
