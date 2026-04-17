import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import Layout from '../components/Layout.jsx';
import { buildApplicantNav } from '../lib/navigation.js';

function emptyForm() {
  return {
    premises_name: '',
    address_line_1: '',
    address_line_2: '',
    town_or_city: '',
    postcode: '',
    premises_description: '',
  };
}

export default function PremisesFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isNew = !id;
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isNew) return;

    api.getPremises(id)
      .then((data) => {
        setForm({
          premises_name: data.premises_name ?? '',
          address_line_1: data.address_line_1 ?? '',
          address_line_2: data.address_line_2 ?? '',
          town_or_city: data.town_or_city ?? '',
          postcode: data.postcode ?? '',
          premises_description: data.premises_description ?? '',
        });
      })
      .catch((err) => setError(err.message || 'Could not load premises.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function setField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      premises_name: form.premises_name,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2,
      town_or_city: form.town_or_city,
      postcode: form.postcode,
      premises_description: form.premises_description,
    };

    try {
      const premises = isNew
        ? await api.createPremises(payload)
        : await api.updatePremises(id, payload);

      const returnTo = searchParams.get('returnTo');
      const returnPremises = searchParams.get('premises');
      if (returnTo === 'apply') {
        navigate(`/apply?premises=${returnPremises || premises.id}`);
        return;
      }

      setNotice(isNew ? 'Premises created.' : 'Premises updated.');
      navigate(`/premises/${premises.id}`);
    } catch (err) {
      setError(err.message || 'Could not save premises.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout
      breadcrumbs={[
        { to: '/', label: 'Applicant portal' },
        { to: '/premises', label: 'Premises' },
        { label: isNew ? 'New premises' : 'Edit premises' },
      ]}
      navItems={buildApplicantNav(session)}
    >
      <Link to="/premises" className="back-link">
        Back to premises
      </Link>

      <section className="form-section">
        <div className="form-section-title">Premises record</div>
        <h1 className="page-title">{isNew ? 'Add premises' : 'Edit premises'}</h1>
        <p className="page-subtitle">
          Keep the core premises details here so you can reuse them on future applications.
        </p>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="form-group">
              <label htmlFor="premises_name">Premises name or trading name</label>
              <input id="premises_name" value={form.premises_name} onChange={setField('premises_name')} />
            </div>

            <div className="platform-two-column">
              <div className="form-group">
                <label htmlFor="address_line_1">Address line 1</label>
                <input id="address_line_1" value={form.address_line_1} onChange={setField('address_line_1')} />
              </div>
              <div className="form-group">
                <label htmlFor="address_line_2">Address line 2</label>
                <input id="address_line_2" value={form.address_line_2} onChange={setField('address_line_2')} />
              </div>
              <div className="form-group">
                <label htmlFor="town_or_city">Town or city</label>
                <input id="town_or_city" value={form.town_or_city} onChange={setField('town_or_city')} />
              </div>
              <div className="form-group">
                <label htmlFor="postcode">Postcode</label>
                <input id="postcode" value={form.postcode} onChange={setField('postcode')} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="premises_description">Description</label>
              <textarea
                id="premises_description"
                rows={4}
                value={form.premises_description}
                onChange={setField('premises_description')}
              />
              <span className="form-hint">
                Optional summary for the type of premises, venue use, or activities.
              </span>
            </div>
          </section>

          <div className="platform-hero-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isNew ? 'Create premises' : 'Save premises'}
            </button>
            <Link className="btn btn-secondary" to="/premises">Cancel</Link>
          </div>
        </form>
      )}
    </Layout>
  );
}
