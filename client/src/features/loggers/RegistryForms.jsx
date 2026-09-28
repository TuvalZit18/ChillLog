// Add logger · Add fridge · Add branch dialogs (docs/design/ui.md, "Loggers"). Loaded only when
// one opens (react-hook-form + Zod). Each form uses the same shared Zod schema as the server.

import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { branchInput, fridgeInput, loggerInput } from '@chilllog/shared';
import { toIsraelLocal } from '../../shared/format/format.js';
import button from '../../shared/ui/button.module.css';
import { Dialog, DialogActions } from '../../shared/ui/Dialog.jsx';
import field from '../../shared/ui/field.module.css';
import { describedBy, FormField } from '../../shared/ui/FormField.jsx';
import { applyServerError } from '../../shared/ui/serverErrors.js';
import { useAddBranchMutation, useAddFridgeMutation, useAddLoggerMutation } from './loggersApi.js';
import styles from './RegistryForms.module.css';

const emptyToUndefined = (value) => (value === '' ? undefined : value);

function FormError({ errors }) {
  return errors.root ? (
    <p className={field.error} role="alert">
      {errors.root.message}
    </p>
  ) : null;
}

function Buttons({ onClose, submitting, label }) {
  return (
    <DialogActions>
      <button type="button" className={button.button} onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className={`${button.button} ${button.primary}`} disabled={submitting}>
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

        <div className={styles.two}>
          <FormField id="logger-unit" label="Unit in its files">
            <select id="logger-unit" {...register('unit')}>
              <option value="C">°C</option>
              <option value="F">°F</option>
            </select>
          </FormField>
          <FormField id="logger-format" label="Date format in its files">
            <select id="logger-format" {...register('dateFormat')}>
              <option value="DD/MM">Day first (21/09)</option>
              <option value="MM/DD">Month first (09/21)</option>
            </select>
          </FormField>
        </div>

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
