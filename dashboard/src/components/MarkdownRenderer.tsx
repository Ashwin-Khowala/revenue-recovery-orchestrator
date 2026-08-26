'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

export default function MarkdownRenderer({ content, className = '', isDark = false }: MarkdownRendererProps) {
  return (
    <div className={`markdown-output text-xs leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className={`text-sm font-bold mt-2 mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className={`text-xs font-bold mt-2 mb-1 ${isDark ? 'text-cyan-300' : 'text-[#00A3C4]'}`} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className={`text-xs font-semibold mt-1.5 mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className={`mb-1.5 last:mb-0 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className={`italic ${isDark ? 'text-slate-300' : 'text-slate-600'}`} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="space-y-1 my-1.5 pl-4 list-disc marker:text-[#00A3C4]" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="space-y-1 my-1.5 pl-4 list-decimal marker:text-[#00A3C4]" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className={`${isDark ? 'text-slate-200' : 'text-slate-700'}`} {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-200 shadow-2xs">
              <table className="min-w-full divide-y divide-slate-200 text-[11px]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className={isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700 font-bold'} {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className={`divide-y ${isDark ? 'divide-slate-700 bg-slate-900' : 'divide-slate-100 bg-white'}`} {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className={isDark ? 'hover:bg-slate-800/60 transition-colors' : 'hover:bg-slate-50 transition-colors'} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-2.5 py-1.5 text-left font-bold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-2.5 py-1.5 whitespace-nowrap" {...props} />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            if (isInline) {
              return (
                <code
                  className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                    isDark
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'bg-slate-100 text-[#00829B] border border-slate-200 font-semibold'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div className="relative my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 p-2.5 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                <pre {...props}>
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          blockquote: ({ node, ...props }) => (
            <blockquote
              className={`pl-3 my-1.5 border-l-2 text-[11px] italic ${
                isDark ? 'border-cyan-500 text-slate-300 bg-slate-800/40' : 'border-[#00A3C4] text-slate-600 bg-cyan-50/50'
              } py-1 pr-2 rounded-r`}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
