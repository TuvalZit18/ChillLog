// Add logger · Add fridge · Add branch dialogs (docs/design/ui.md, "Loggers"). Loaded only when
// one opens (react-hook-form + Zod). Each form uses the same shared Zod schema as the server.

import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  branchInput,
  fridgeInput,
  loggerInput,
  loggerSettingsInput,
  moveInput,
} from '@chilllog/shared';
import { toIsraelLocal } from '../../shared/format/format.js';
import button from '../../shared/ui/button.module.css';
import { Dialog, DialogActions } from '../../shared/ui/Dialog.jsx';
import field from '../../shared/ui/field.module.css';
import { describedBy, FormField } from '../../shared/ui/FormField.jsx';
import { applyServerError } from '../../shared/ui/serverErrors.js';
import {
  useAddBranchMutation,
  useAddFridgeMutation,
  useAddLoggerMutation,
  useMoveLoggerMutation,
  useUpdateLoggerSettingsMutation,
} from './loggersApi.js';
import { checkMove, DATE_FORMAT_LABELS, UNIT_LABELS } from './loggersModel.js';
import styles from './RegistryForms.module.css';

const emptyToUndefined = (value) => (value === '' ? undefined : value);

function FormError({ errors }) {
  return errors.root ? (
    <p className={field.error} role="alert">
      {errors.root.message}
    </p>
  ) : null;
}

/** Unit and date format: how a logger writes its files (Add logger, Change file settings). */
function FileSettingsFields({ register, idPrefix, dateHint }) {
  return (
    <div className={styles.two}>
      <FormField id={`${idPrefix}-unit`} label="Unit in its files">
        <select id={`${idPrefix}-unit`} {...register('unit')}>
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={`${idPrefix}-format`} label="Date format in its files" hint={dateHint}>
        <select
          id={`${idPrefix}-format`}
          aria-describedby={describedBy(`${idPrefix}-format`, { hint: dateHint })}
          {...register('dateFormat')}
        >
          {Object.entries(DATE_FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

function Buttons({ onClose, submitting, label, disabled = false }) {
  return (
    <DialogActions>
      <button type="button" className={button.button} onClick={onClose}>
        Cancel
      </button>
      <button
        type="submit"
        className={`${button.button} ${button.primary}`}
        disabled={submitting || disabled}
      >
        {submitting ? 'Saving…' : label}
      </button>
    </DialogActions>
  );
}

/**
 * Register a logger by the ID printed on it, and optionally put it in a fridge from a date.
 * @param {{ branches: object[], onClose: () => void, onAdded: (logger: object) => void }} props
 */
export function AddLoggerDialog({ branches, onClose, onAdded }) {
  const titleId = useId();
  const today = toIsraelLocal(new Date()).slice(0, 10);
  const [addLogger] = useAddLoggerMutation();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loggerInput),
    // Hidden fields (no fridge chosen, so no date) drop out of the values instead of lingering.
    shouldUnregister: true,
    defaultValues: { code: '', unit: 'C', dateFormat: 'DD/MM', placeBranchId: '' },
  });
  // useWatch (not watch) so the React Compiler can still optimise this component.
  const [placeBranchId, fridgeId] = useWatch({ control, name: ['placeBranchId', 'fridgeId'] });
  const fridges = branches.find((b) => String(b.id) === placeBranchId)?.fridges ?? [];

  async function submit(values) {
    try {
      onAdded(await addLogger(values).unwrap());
    } catch (error) {
      applyServerError(error, setError, ['code', 'unit', 'dateFormat', 'fridgeId', 'from']);
    }
  }

  const codeHint = 'Printed on the logger, e.g. TL-0512.';
  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <h2 id={titleId}>Add logger</h2>

        <FormField id="logger-code" label="Logger ID" hint={codeHint} error={errors.code?.message}>
          <input
            id="logger-code"
            placeholder="TL-0000"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={describedBy('logger-code', { hint: codeHint, error: errors.code })}
            {...register('code')}
          />
        </FormField>

        <div className={styles.two}>
          <FormField id="logger-branch" label="Branch">
            <select id="logger-branch" {...register('placeBranchId')}>
              <option value="">Not in a fridge yet</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="logger-fridge" label="Fridge" error={errors.fridgeId?.message}>
            {/* Re-mounted per branch, so it starts empty when the branch changes. */}
            <select
              key={placeBranchId}
              id="logger-fridge"
              disabled={!placeBranchId}
              aria-invalid={errors.fridgeId ? true : undefined}
              {...register('fridgeId', { setValueAs: emptyToUndefined })}
            >
              <option value="">Choose a fridge</option>
              {fridges.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {fridgeId && (
          <FormField id="logger-from" label="In this fridge from" error={errors.from?.message}>
            <input
              id="logger-from"
              type="date"
              defaultValue={today}
              max={today}
              aria-invalid={errors.from ? true : undefined}
              {...register('from', { setValueAs: emptyToUndefined })}
            />
          </FormField>
        )}

        <FileSettingsFields register={register} idPrefix="logger" />

        <FormError errors={errors} />
        <Buttons onClose={onClose} submitting={isSubmitting} label="Add logger" />
      </form>
    </Dialog>
  );
}

/**
 * @param {{ branch: { id: number, name: string }, onClose: () => void,
 *   onAdded: (fridge: object) => void }} props
 */
export function AddFridgeDialog({ branch, onClose, onAdded }) {
  const titleId = useId();
  const [addFridge] = useAddFridgeMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(fridgeInput),
    defaultValues: { branchId: branch.id, name: '' },
  });

  async function submit(values) {
    try {
      onAdded(await addFridge(values).unwrap());
    } catch (error) {
      applyServerError(error, setError, ['name']);
    }
  }

  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <h2 id={titleId}>Add a fridge in {branch.name}</h2>
        <input type="hidden" {...register('branchId')} />
        <FormField id="fridge-name" label="Fridge name" error={errors.name?.message}>
          <input
            id="fridge-name"
            placeholder="e.g. Display 3"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('fridge-name', { error: errors.name })}
            {...register('name')}
          />
        </FormField>
        <FormError errors={errors} />
        <Buttons onClose={onClose} submitting={isSubmitting} label="Add fridge" />
      </form>
    </Dialog>
  );
}

/** @param {{ onClose: () => void, onAdded: (branch: object) => void }} props */
export function AddBranchDialog({ onClose, onAdded }) {
  const titleId = useId();
  const [addBranch] = useAddBranchMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(branchInput), defaultValues: { name: '' } });

  async function submit(values) {
    try {
      onAdded(await addBranch(values).unwrap());
    } catch (error) {
      applyServerError(error, setError, ['name']);
    }
  }

  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <h2 id={titleId}>Add branch</h2>
        <FormField id="branch-name" label="Branch name" error={errors.name?.message}>
          <input
            id="branch-name"
            placeholder="e.g. Kfar Saba"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('branch-name', { error: errors.name })}
            {...register('name')}
          />
        </FormField>
        <FormError errors={errors} />
        <Buttons onClose={onClose} submitting={isSubmitting} label="Add branch" />
      </form>
    </Dialog>
  );
}

/** Our own messages (set with type 'manual') are shown as they are; schema ones get plain words. */
const fieldMessage = (error, plain) => error && (error.type === 'manual' ? error.message : plain);

/**
 * Move a logger to another fridge from a date: readings from then on go to the new fridge.
 * @param {{ logger: object, branches: object[], onClose: () => void,
 *   onMoved: (logger: object) => void }} props
 */
export function MoveLoggerDialog({ logger, branches, onClose, onMoved }) {
  const titleId = useId();
  const today = toIsraelLocal(new Date()).slice(0, 10);
  const [moveLogger] = useMoveLoggerMutation();
  const currentBranch = branches.find((b) =>
    b.fridges.some((f) => f.id === logger.current?.fridgeId),
  );
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(moveInput),
    shouldUnregister: true,
    defaultValues: { branchId: currentBranch ? String(currentBranch.id) : '', from: today },
  });
  const branchId = useWatch({ control, name: 'branchId' });
  const fridges = branches.find((b) => String(b.id) === branchId)?.fridges ?? [];

  async function submit(values) {
    const problem = checkMove(values, logger);
    if (problem) {
      setError(problem.field, { type: 'manual', message: problem.message });
      return;
    }
    try {
      onMoved(await moveLogger({ id: logger.id, ...values }).unwrap());
    } catch (error) {
      applyServerError(error, setError, ['fridgeId', 'from']);
    }
  }

  const fridgeError = fieldMessage(errors.fridgeId, 'Choose the fridge it moves into.');
  const fromError = fieldMessage(errors.from, 'Pick the date it moved.');
  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <div className={styles.intro}>
          <h2 id={titleId}>Move {logger.code}</h2>
          <p className="small muted">
            Readings from the chosen date go to the new fridge. Earlier readings stay where they
            were.
          </p>
        </div>

        <div className={styles.two}>
          <FormField id="move-branch" label="New branch">
            <select id="move-branch" {...register('branchId')}>
              <option value="">Choose a branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="move-fridge" label="New fridge" error={fridgeError}>
            <select
              key={branchId}
              id="move-fridge"
              disabled={!branchId}
              aria-invalid={fridgeError ? true : undefined}
              aria-describedby={describedBy('move-fridge', { error: fridgeError })}
              {...register('fridgeId', { setValueAs: emptyToUndefined })}
            >
              <option value="">Choose a fridge</option>
              {fridges.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="move-from" label="From date" error={fromError}>
          <input
            id="move-from"
            type="date"
            max={today}
            aria-invalid={fromError ? true : undefined}
            aria-describedby={describedBy('move-from', { error: fromError })}
            {...register('from')}
          />
        </FormField>

        <FormError errors={errors} />
        <Buttons onClose={onClose} submitting={isSubmitting} label="Move logger" />
      </form>
    </Dialog>
  );
}

/**
 * How a logger writes its files. Files held back under the old setting are tried again.
 * @param {{ logger: object, onClose: () => void, onSaved: (logger: object) => void }} props
 */
export function LoggerSettingsDialog({ logger, onClose, onSaved }) {
  const titleId = useId();
  const [updateSettings] = useUpdateLoggerSettingsMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(loggerSettingsInput),
    defaultValues: { unit: logger.unit, dateFormat: logger.dateFormat },
  });

  async function submit(values) {
    try {
      onSaved(await updateSettings({ id: logger.id, ...values }).unwrap());
    } catch (error) {
      applyServerError(error, setError, ['unit', 'dateFormat']);
    }
  }

  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <div className={styles.intro}>
          <h2 id={titleId}>File settings for {logger.code}</h2>
          <p className="small muted">
            How this logger writes its files. ChillLog converts everything to °C.
          </p>
        </div>
        <FileSettingsFields
          register={register}
          idPrefix="settings"
          dateHint="Only used when a date could be read either way, like 05/09."
        />
        <FormError errors={errors} />
        <Buttons
          onClose={onClose}
          submitting={isSubmitting}
          disabled={!isDirty}
          label="Save settings"
        />
      </form>
    </Dialog>
  );
}
