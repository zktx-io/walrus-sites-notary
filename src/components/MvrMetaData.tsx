import {
  BookOpen,
  Contact2,
  ExternalLink,
  Home,
  ImageIcon,
  Text,
  Mail,
  Twitter,
} from 'lucide-react';

import { MvrData } from '../utils/getMvrData';

export const MvrMetaData = ({ mvrData }: { mvrData: MvrData }) => {
  const parseContact = (contact?: string) => {
    if (!contact) return null;

    if (/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(contact)) {
      return {
        type: 'email',
        icon: <Mail className="w-4 h-4 text-gray-400" />,
        href: `mailto:${contact}`,
        label: contact,
      };
    }

    if (
      contact.startsWith('https://twitter.com/') ||
      contact.startsWith('https://x.com/')
    ) {
      return {
        type: 'twitter',
        icon: <Twitter className="w-4 h-4 text-gray-400" />,
        href: contact,
        label: contact.replace(/^https:\/\/(twitter\.com|x\.com)\//, '@'),
      };
    }

    return {
      type: 'text',
      icon: <Contact2 className="w-4 h-4 text-gray-400" />,
      label: contact,
    };
  };

  const contactInfo = parseContact(mvrData.metadata?.contact);

  return (
    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      {[
        [
          <Home className="w-4 h-4 text-gray-400" />,
          'Homepage',
          mvrData.metadata?.homepage_url,
          mvrData.metadata?.homepage_url,
        ],
        [
          <BookOpen className="w-4 h-4 text-gray-400" />,
          'Document',
          mvrData.metadata?.documentation_url,
          mvrData.metadata?.documentation_url,
        ],
        [
          <ImageIcon className="w-4 h-4 text-gray-400" />,
          'Icon',
          mvrData.metadata?.icon_url,
          mvrData.metadata?.icon_url,
        ],
      ].map(([icon, label, value, link], idx) => {
        return (
          <div key={idx} className="flex items-start">
            <div className="w-30 shrink-0 flex items-center gap-2 text-gray-400 pt-1">
              {icon}
              {label}
            </div>
            <div className="mx-2 text-gray-500">:</div>
            <div className="flex-1 flex items-center gap-1 truncate">
              {link && typeof link === 'string' ? (
                <div className="flex items-center gap-1 truncate">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-blue-300 underline"
                    title={String(link)}
                  >
                    {value}
                  </a>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-300"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <code className="text-gray-400">{value || '-'}</code>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-start">
        <div className="w-30 shrink-0 flex items-center gap-2 text-gray-400 pt-1">
          {contactInfo?.icon || <Contact2 className="w-4 h-4 text-gray-400" />}
          Contact
        </div>
        <div className="mx-2 text-gray-500">:</div>
        <div className="flex items-center gap-1 truncate">
          {contactInfo?.href ? (
            <div className="flex items-center gap-1 truncate">
              <a
                href={contactInfo.href}
                target="_blank"
                rel="noreferrer"
                className="truncate text-blue-300 underline"
                title={contactInfo.href}
              >
                <span className="truncate">{contactInfo.label}</span>
              </a>
              <a
                href={contactInfo.href}
                target="_blank"
                rel="noreferrer"
                className="text-blue-300"
                title="Open link"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <code className="text-gray-400">{contactInfo?.label || '-'}</code>
          )}
        </div>
      </div>

      <div className="flex items-start">
        <div className="w-30 shrink-0 flex items-center gap-2 text-gray-400 pt-1">
          <Text className="w-4 h-4 text-gray-400" /> Description
        </div>
        <div className="mx-2 text-gray-500">:</div>
      </div>
      <div className="text-gray-400">{mvrData.metadata?.description}</div>
    </div>
  );
};
