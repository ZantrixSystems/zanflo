export const APPLICANT_APPLICATION_SETUP_FIELDS = [
  {
    field_key: 'applicant_phone',
    label: 'Phone number',
    help_text: 'Optional phone number for the legal applicant.',
    enabled: true,
    required: false,
    sensitive: true,
  },
  {
    field_key: 'premises_description',
    label: 'Description',
    help_text: 'Brief description, for example type of venue, capacity, or planned activities.',
    enabled: true,
    required: false,
    sensitive: false,
  },
  {
    field_key: 'contact_name',
    label: 'Contact name',
    help_text: 'Who should the council contact about this application?',
    enabled: true,
    required: false,
    sensitive: false,
  },
  {
    field_key: 'contact_email',
    label: 'Contact email',
    help_text: 'Email for the person handling council correspondence.',
    enabled: true,
    required: false,
    sensitive: false,
  },
  {
    field_key: 'contact_phone',
    label: 'Contact phone',
    help_text: 'Phone number for the person handling council correspondence.',
    enabled: true,
    required: false,
    sensitive: true,
  },
];

export function formatPremisesAddress(premises) {
  return [
    premises?.address_line_1,
    premises?.address_line_2,
    premises?.town_or_city,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n') || null;
}

export function buildApplicationPremisesSnapshot(premises) {
  return {
    premises_name: premises.premises_name,
    premises_address: formatPremisesAddress(premises),
    premises_postcode: premises.postcode,
    premises_description: premises.premises_description ?? null,
  };
}

export function normalisePremisesPayload(body = {}) {
  return {
    premises_name: body.premises_name?.trim() || '',
    address_line_1: body.address_line_1?.trim() || '',
    address_line_2: body.address_line_2?.trim() || null,
    town_or_city: body.town_or_city?.trim() || null,
    postcode: body.postcode?.trim().toUpperCase() || '',
    premises_description: body.premises_description?.trim() || null,
  };
}

export function validatePremisesPayload(premises) {
  if (!premises.premises_name) return 'Premises name is required';
  if (!premises.address_line_1) return 'Address line 1 is required';
  if (!premises.postcode) return 'Postcode is required';
  return null;
}

export function mergeApplicationFieldSettings(rows = []) {
  const overridesByKey = new Map(rows.map((row) => [row.field_key, row]));

  return APPLICANT_APPLICATION_SETUP_FIELDS.map((field) => {
    const override = overridesByKey.get(field.field_key);
    return {
      ...field,
      label_override: override?.label_override ?? null,
      help_text: override?.help_text ?? field.help_text,
      enabled: override?.enabled ?? field.enabled,
      required: override?.required ?? field.required,
      sensitive: override?.sensitive ?? field.sensitive,
    };
  });
}

export function isKnownApplicationSetupField(fieldKey) {
  return APPLICANT_APPLICATION_SETUP_FIELDS.some((field) => field.field_key === fieldKey);
}
