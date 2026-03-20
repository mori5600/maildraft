import {
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import type { WorkspaceView } from "../shared/types/store";

type WorkspaceViewIcon = typeof EnvelopeIcon;

export interface WorkspaceViewStrategy {
  description: string;
  icon: WorkspaceViewIcon;
  title: string;
}

export const WORKSPACE_VIEW_STRATEGIES = {
  drafts: {
    title: "下書き",
    description: "件名・本文・署名を分けて編集",
    icon: EnvelopeIcon,
  },
  templates: {
    title: "テンプレート",
    description: "定型文と推奨署名を管理",
    icon: DocumentDuplicateIcon,
  },
  signatures: {
    title: "署名",
    description: "差出人プロフィールを管理",
    icon: UserCircleIcon,
  },
  memo: {
    title: "メモ",
    description: "自由記述のローカルメモを保存",
    icon: PencilSquareIcon,
  },
  trash: {
    title: "ゴミ箱",
    description: "削除した項目を復元または完全削除",
    icon: TrashIcon,
  },
  settings: {
    title: "設定",
    description: "ログとバックアップを管理",
    icon: Cog6ToothIcon,
  },
  help: {
    title: "ヘルプ",
    description: "ショートカットと基本操作を見る",
    icon: QuestionMarkCircleIcon,
  },
} satisfies Record<WorkspaceView, WorkspaceViewStrategy>;
