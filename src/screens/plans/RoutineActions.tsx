import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CheckGlyph, ChevronRight } from '../../components/icons';
import { Alert, HoldMenu, Sheet, SheetOption, useToast, type MenuItem } from '../../components/overlays';
import { Button, TextField } from '../../components/ui';
import { createFolder, deleteFolder, deleteRoutine, duplicateRoutine, moveRoutine, renameFolder, setActiveFolder, setFolderArchived } from '../../data/routines';
import type { PlansData } from '../../data/usePlans';
import type { Folder, Routine } from '../../db/types';
import { useStartWorkout } from '../../hooks/StartWorkout';

/**
 * Routine shortcuts shared by Plans (hold, 2.8) and the routine screen (•••):
 * start, edit, duplicate, move to folder (2.10), delete.
 */
export function useRoutineActions(plans: PlansData | undefined) {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const toast = useToast();
  const [menu, setMenu] = useState<{ routine: Routine; rect: DOMRect; showOpen?: boolean } | null>(null);
  const [moving, setMoving] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [newFolderFor, setNewFolderFor] = useState<Routine | null>(null);

  const folderName = (id?: string) => plans?.folders.find((f) => f.id === id)?.name ?? 'No folder';

  const items = (r: Routine): MenuItem[] => [
    { label: 'Start workout', glyph: '▶', tone: 'accent', onClick: () => start.startRoutine(r.id, r.name) },
    { label: 'Edit routine', glyph: '✎', onClick: () => navigate(`/routine/${r.id}/edit`) },
    {
      label: 'Duplicate',
      glyph: '⧉',
      onClick: async () => {
        await duplicateRoutine(r.id);
        toast({ message: `Made a copy of ${r.name}` });
      },
    },
    { label: 'Move to folder…', glyph: `${folderName(r.folderId)} ›`, onClick: () => setMoving(r) },
    { label: 'Delete', tone: 'danger', onClick: () => setDeleting(r) },
  ];

  const element: ReactNode = (
    <>
      <HoldMenu open={!!menu} anchor={menu?.rect} items={menu ? items(menu.routine) : []} onClose={() => setMenu(null)} />
      <Sheet open={!!moving} onClose={() => setMoving(null)} title={moving ? `Move "${moving.name}"` : 'Move'} subtitle="Pick a folder">
        {plans?.folders.map((f) => (
          <SheetOption
            key={f.id}
            onClick={async () => {
              if (moving) await moveRoutine(moving.id, f.id);
              setMoving(null);
            }}
            detail={
              <>
                {f.archived && 'archived'}
                {moving?.folderId === f.id && <CheckGlyph size={15} className="text-accent" />}
              </>
            }
          >
            {f.name}
          </SheetOption>
        ))}
        <SheetOption
          onClick={async () => {
            if (moving) await moveRoutine(moving.id, undefined);
            setMoving(null);
          }}
          detail={!moving?.folderId || !plans?.folders.some((f) => f.id === moving.folderId) ? <CheckGlyph size={15} className="text-accent" /> : undefined}
        >
          No folder
        </SheetOption>
        <SheetOption
          tone="accent"
          onClick={() => {
            setNewFolderFor(moving);
            setMoving(null);
          }}
        >
          + New folder…
        </SheetOption>
      </Sheet>
      <NewFolderSheet
        open={!!newFolderFor}
        onClose={() => setNewFolderFor(null)}
        onCreated={async (id) => {
          if (newFolderFor) await moveRoutine(newFolderFor.id, id);
          setNewFolderFor(null);
        }}
      />
      <Alert
        open={!!deleting}
        title={`Delete ${deleting?.name ?? 'routine'}?`}
        message="Its workouts stay in History."
        onClose={() => setDeleting(null)}
        actions={[
          {
            label: 'Delete routine',
            kind: 'danger',
            onClick: async () => {
              const r = deleting;
              setDeleting(null);
              if (r) {
                await deleteRoutine(r.id);
                toast({ message: `${r.name} deleted` });
              }
            },
          },
          { label: 'Cancel', onClick: () => setDeleting(null) },
        ]}
      />
    </>
  );

  return {
    element,
    openMenu: (routine: Routine, rect: DOMRect) => setMenu({ routine, rect }),
    move: (r: Routine) => setMoving(r),
    remove: (r: Routine) => setDeleting(r),
    duplicate: async (r: Routine) => {
      const id = await duplicateRoutine(r.id);
      toast({ message: `Made a copy of ${r.name}` });
      return id;
    },
  };
}

export function NewFolderSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState('');
  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    const id = await createFolder(n);
    setName('');
    onClose();
    onCreated?.(id);
  };
  return (
    <Sheet open={open} onClose={onClose} title="New folder" subtitle="A program or a group of routines, like PPL or Upper / Lower.">
      <TextField value={name} onChange={setName} autoFocus placeholder="Folder name" onEnter={() => void submit()} />
      <Button className="mt-4" disabled={!name.trim()} onClick={() => void submit()}>
        Create folder
      </Button>
    </Sheet>
  );
}

/** 2.9: rename in place, make active, archive, new routine here, delete. */
export function FolderSheet({ folder, count, onClose }: { folder: Folder | null; count: number; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(folder?.name ?? '');
  const [confirm, setConfirm] = useState(false);
  const [lastId, setLastId] = useState(folder?.id);
  if (folder?.id !== lastId) {
    setLastId(folder?.id);
    setName(folder?.name ?? '');
  }
  const commit = () => {
    if (folder && name.trim() && name.trim() !== folder.name) void renameFolder(folder.id, name);
  };
  const close = () => {
    commit();
    onClose();
  };
  return (
    <>
      <Sheet open={!!folder && !confirm} onClose={close} title={`Folder: ${folder?.name ?? ''}`} subtitle={`${count} ${count === 1 ? 'routine' : 'routines'}`}>
        <div className="text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">Name</div>
        <TextField value={name} onChange={setName} onBlur={commit} onEnter={commit} />
        <div className="mt-2">
          <SheetOption
            onClick={() => {
              if (folder && !folder.active) void setActiveFolder(folder.id);
            }}
            detail={
              folder?.active ? (
                <>
                  shown on Home <CheckGlyph size={15} className="text-accent" />
                </>
              ) : (
                'make it what Home shows'
              )
            }
          >
            Active folder
          </SheetOption>
          <SheetOption
            onClick={() => {
              close();
              if (folder) navigate(`/plan/${folder.id}/schedule`);
            }}
            detail={<ChevronRight size={12} />}
          >
            Schedule…
          </SheetOption>
          <SheetOption
            onClick={() => {
              if (folder) void setFolderArchived(folder.id, !folder.archived);
              close();
            }}
            detail={folder?.archived ? 'back with the others' : 'moves to the bottom'}
          >
            {folder?.archived ? 'Unarchive folder' : 'Archive folder'}
          </SheetOption>
          <SheetOption
            onClick={() => {
              close();
              if (folder) navigate(`/routine/new?folder=${folder.id}`);
            }}
            detail={<ChevronRight size={12} />}
          >
            New routine in this folder
          </SheetOption>
          <SheetOption tone="danger" onClick={() => setConfirm(true)} detail="keeps its routines">
            Delete folder…
          </SheetOption>
        </div>
      </Sheet>
      <Alert
        open={!!folder && confirm}
        title={`Delete ${folder?.name ?? 'folder'}?`}
        message={count ? `Its ${count} ${count === 1 ? 'routine moves' : 'routines move'} to "No folder". Nothing else is deleted.` : 'It has no routines.'}
        onClose={() => setConfirm(false)}
        actions={[
          {
            label: 'Delete folder',
            kind: 'danger',
            onClick: async () => {
              setConfirm(false);
              if (folder) await deleteFolder(folder.id);
              onClose();
            },
          },
          { label: 'Cancel', onClick: () => setConfirm(false) },
        ]}
      />
    </>
  );
}
