'use client'

import type { Role } from '@/hooks/useAuthRole'

type Props = {
  previewRole: Role
  onChangePreview: (role: Role) => void
}

const ROLES: Array<{ value: Role; label: string }> = [
  { value: null,     label: '未ログイン' },
  { value: 'user',   label: 'User' },
  { value: 'paid',   label: 'Paid' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin',  label: 'Admin（実際）' },
]

/**
 * admin 専用：ロールをなりすましてUIを確認するバナー
 * previewRole が null（= admin 本来の状態）のときは非表示
 */
export default function PreviewRoleBanner({ previewRole, onChangePreview }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center
      gap-3 px-4 py-1.5 bg-violet-900/90 border-b border-violet-600/60 backdrop-blur-sm text-xs">
      <span className="text-violet-300 font-medium">🎭 プレビューモード</span>
      <div className="flex gap-1">
        {ROLES.map(({ value, label }) => (
          <button
            key={String(value)}
            onClick={() => onChangePreview(value)}
            className={`px-2 py-0.5 rounded transition-colors ${
              previewRole === value
                ? 'bg-violet-500 text-white'
                : 'bg-violet-900/60 text-violet-300 hover:bg-violet-700/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
