import { useRef, useState } from 'react';
import '../styles/subnet.css';
import {
  isValidIp,
  isValidSubnetMask,
  cidrToMask,
  calculateHostSubnets,
  calculatePowerOfTwoResult,
  createSubnetResult,
} from '../lib/subnet.js';

const TABS = [
  { id: 'subnet-calc', label: 'Subnet Calculator' },
  { id: 'host-calc', label: 'Host Calculator' },
  { id: 'power-calc', label: 'Power of 2 Calculator' },
];

// The original filled these in as example values on first focus.
const EXAMPLES = {
  ip: '192.168.1.1',
  subnet: '255.255.255.0',
  hostIp: '192.168.1.0',
  hostSubnet: '/24',
  hostCount: '50',
};

// Must go through React state: writing to e.target.value directly leaves the
// controlled input's state empty, so Calculate would read '' and always error.
function fillExampleOnFocus(currentValue, setValue, exampleValue) {
  return () => {
    if (!currentValue) setValue(exampleValue);
  };
}

export default function Subnet() {
  const [activeTab, setActiveTab] = useState('subnet-calc');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { type: 'subnet' | 'power' | 'hosts', title, data }
  const [compactDisplay, setCompactDisplay] = useState(false);

  const [hostInputs, setHostInputs] = useState([{ id: 1, value: '' }]);
  const [hostInputsVisible, setHostInputsVisible] = useState(true);
  const nextHostInputId = useRef(2);

  function switchTab(tabId) {
    if (activeTab === tabId) return;
    setActiveTab(tabId);
    clearResults();
  }

  function clearResults() {
    setError('');
    setResult(null);
  }

  function showError(message) {
    setResult(null);
    setError(message);
  }

  function addHostInput() {
    setHostInputs((prev) => [...prev, { id: nextHostInputId.current++, value: '' }]);
  }

  function removeHostInput(id) {
    setHostInputs((prev) => (prev.length > 1 ? prev.filter((input) => input.id !== id) : prev));
  }

  function updateHostInput(id, value) {
    setHostInputs((prev) => prev.map((input) => (input.id === id ? { ...input, value } : input)));
  }

  // ─── Calculations ──────────────────────────────────────────────────────

  function calculateSubnet(ipAddress, subnetMaskRaw) {
    clearResults();
    try {
      if (!isValidIp(ipAddress)) throw new Error('Invalid IP address format');

      let subnetMask = subnetMaskRaw;
      if (subnetMask.startsWith('/')) {
        const cidr = parseInt(subnetMask.substring(1), 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
          throw new Error('CIDR notation must be between /0 and /32');
        }
        subnetMask = cidrToMask(cidr);
      }

      if (!isValidIp(subnetMask) || !isValidSubnetMask(subnetMask)) {
        throw new Error('Invalid subnet mask format');
      }

      const data = createSubnetResult(ipAddress, subnetMask);
      setResult({ type: 'subnet', title: 'Subnet Calculation Results', data });
    } catch (err) {
      showError(err.message);
    }
  }

  function calculatePowerOfTwo(hostCountInput) {
    clearResults();
    try {
      if (!hostCountInput) throw new Error('Please enter a number of hosts needed');

      const hostCount = parseInt(hostCountInput, 10);
      if (isNaN(hostCount) || hostCount <= 0) throw new Error('Please enter a positive number');
      if (hostCount > 4294967296) throw new Error('Please enter a number smaller than 2^32');

      const data = calculatePowerOfTwoResult(hostCount);
      setResult({ type: 'power', title: 'Power of 2 Calculation Results', data });
    } catch (err) {
      showError(err.message);
    }
  }

  function calculateForHosts(ipAddress, subnetMaskInput) {
    clearResults();
    try {
      if (!ipAddress) throw new Error('Please enter a network IP address');
      if (!isValidIp(ipAddress)) throw new Error('Invalid IP address format');

      const hostRequirements = [];
      hostInputs.forEach(({ value }, index) => {
        const trimmed = value.trim();
        if (!trimmed) {
          if (index === 0) throw new Error('Please enter at least one host requirement');
          return;
        }

        const numValue = parseInt(trimmed, 10);
        if (isNaN(numValue)) throw new Error(`Invalid number in host requirement: ${trimmed}`);
        if (numValue <= 0) throw new Error(`Host requirement must be positive: ${trimmed}`);
        if (numValue > 16777214) {
          throw new Error(`Host requirement too large (max 16777214): ${trimmed}`);
        }

        hostRequirements.push(numValue);
      });

      const data = calculateHostSubnets(ipAddress, subnetMaskInput, hostRequirements);
      setResult({ type: 'hosts', title: 'Host Allocation Results', data });
    } catch (err) {
      showError(err.message);
    }
  }

  function handleEnter(e, submit) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  return (
    <>
      <div className="tabs">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <SubnetCalcTab
        active={activeTab === 'subnet-calc'}
        onCalculate={calculateSubnet}
        onEnter={handleEnter}
      />
      <HostCalcTab
          active={activeTab === 'host-calc'}
          hostInputs={hostInputs}
          hostInputsVisible={hostInputsVisible}
          onToggleHostInputs={() => setHostInputsVisible((v) => !v)}
          onAddHostInput={addHostInput}
          onRemoveHostInput={removeHostInput}
          onUpdateHostInput={updateHostInput}
          onCalculate={calculateForHosts}
          onEnter={handleEnter}
      />
      <PowerCalcTab
        active={activeTab === 'power-calc'}
        onCalculate={calculatePowerOfTwo}
        onEnter={handleEnter}
      />

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="results">
          <h2 id="results-title">
            {result.title}
            {result.type === 'hosts' && (
              <button className="compact-toggle" onClick={() => setCompactDisplay((v) => !v)}>
                {compactDisplay ? 'Sparse' : 'Compact'}
              </button>
            )}
          </h2>
          <div id="results-content">
            {result.type === 'power' && <PowerResult data={result.data} />}
            {result.type === 'subnet' && <SubnetResult data={result.data} />}
            {result.type === 'hosts' && (
              <>
                {result.data.parentNetwork !== null && <NetworkSummary data={result.data} />}
                {compactDisplay ? (
                  <CompactSubnetTable subnets={result.data.subnets} />
                ) : (
                  result.data.subnets.map((subnet) => (
                    <DetailedSubnetResult key={`${subnet.network}/${subnet.cidr}`} subnet={subnet} />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab bodies ─────────────────────────────────────────────────────────────

function SubnetCalcTab({ active, onCalculate, onEnter }) {
  const [ip, setIp] = useState('');
  const [subnet, setSubnet] = useState('');
  const submit = () => onCalculate(ip.trim(), subnet.trim());

  return (
    <div id="subnet-calc" className={`tab-content${active ? ' active' : ''}`}>
      <div className="input-group">
        <label htmlFor="ip">IP Address:</label>
        <input
          type="text"
          id="ip"
          placeholder="e.g., 192.168.1.1"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onFocus={fillExampleOnFocus(ip, setIp, EXAMPLES.ip)}
          onKeyDown={(e) => onEnter(e, submit)}
        />
      </div>
      <div className="input-group">
        <label htmlFor="subnet">Subnet Mask:</label>
        <input
          type="text"
          id="subnet"
          placeholder="e.g., 255.255.255.0 or /24"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          onFocus={fillExampleOnFocus(subnet, setSubnet, EXAMPLES.subnet)}
          onKeyDown={(e) => onEnter(e, submit)}
        />
      </div>
      <div className="button-group">
        <button onClick={submit}>Calculate</button>
      </div>
    </div>
  );
}

function HostCalcTab({
  active,
  hostInputs,
  hostInputsVisible,
  onToggleHostInputs,
  onAddHostInput,
  onRemoveHostInput,
  onUpdateHostInput,
  onCalculate,
  onEnter,
}) {
  const [hostIp, setHostIp] = useState('');
  const [hostSubnet, setHostSubnet] = useState('');
  const submit = () => onCalculate(hostIp.trim(), hostSubnet.trim());

  return (
    <div id="host-calc" className={`tab-content${active ? ' active' : ''}`}>
      <div className="input-group">
        <label htmlFor="host-ip">Network IP Address:</label>
        <input
          type="text"
          id="host-ip"
          placeholder="e.g., 192.168.1.0"
          value={hostIp}
          onChange={(e) => setHostIp(e.target.value)}
          onFocus={fillExampleOnFocus(hostIp, setHostIp, EXAMPLES.hostIp)}
          onKeyDown={(e) => onEnter(e, submit)}
        />
      </div>
      <div className="input-group">
        <label htmlFor="host-subnet">Subnet Mask (optional):</label>
        <input
          type="text"
          id="host-subnet"
          placeholder="e.g., 255.255.255.0 or /24"
          value={hostSubnet}
          onChange={(e) => setHostSubnet(e.target.value)}
          onFocus={fillExampleOnFocus(hostSubnet, setHostSubnet, EXAMPLES.hostSubnet)}
          onKeyDown={(e) => onEnter(e, submit)}
        />
      </div>

      <div className="host-requirements-container">
        <div className="host-requirements-header">
          <label>Host Requirements:</label>
          <button className="toggle-host-inputs" onClick={onToggleHostInputs}>
            {hostInputsVisible ? 'ˇ' : '^'}
          </button>
        </div>
        <div id="host-inputs" style={{ display: hostInputsVisible ? 'block' : 'none' }}>
          {hostInputs.map((input, index) => (
            <div className="host-input-container" key={input.id}>
              <input
                type="number"
                className="host-input"
                placeholder={index === 0 ? 'Number of hosts needed (e.g., 100)' : 'Number of hosts needed (e.g., 50)'}
                min="1"
                value={input.value}
                onChange={(e) => onUpdateHostInput(input.id, e.target.value)}
                onKeyDown={(e) => onEnter(e, submit)}
              />
              <button className="add-host-btn" onClick={onAddHostInput}>+</button>
              {index > 0 && (
                <button className="remove-host-btn" onClick={() => onRemoveHostInput(input.id)}>-</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={submit}>Calculate Subnets</button>
    </div>
  );
}

function PowerCalcTab({ active, onCalculate, onEnter }) {
  const [hostCount, setHostCount] = useState('');
  const submit = () => onCalculate(hostCount.trim());

  return (
    <div id="power-calc" className={`tab-content${active ? ' active' : ''}`}>
      <div className="input-group">
        <label htmlFor="host-count">Number of Hosts Needed:</label>
        <input
          type="number"
          id="host-count"
          placeholder="e.g., 100"
          min="1"
          value={hostCount}
          onChange={(e) => setHostCount(e.target.value)}
          onFocus={fillExampleOnFocus(hostCount, setHostCount, EXAMPLES.hostCount)}
          onKeyDown={(e) => onEnter(e, submit)}
        />
      </div>
      <button onClick={submit}>Calculate</button>
    </div>
  );
}

// ─── Result renderers ───────────────────────────────────────────────────────

function PowerResult({ data }) {
  return (
    <div className="subnet-result">
      <p><strong>Number of Hosts Needed:</strong> {data.hostCount}</p>
      <p><strong>Required Addresses (hosts + network + broadcast):</strong> {data.requiredAddresses}</p>
      <p>
        <strong>Smallest Power of 2 ≥ {data.requiredAddresses}:</strong> {data.subnetSize} (2^{data.hostBits})
      </p>
      <p><strong>Subnet Mask (Decimal):</strong> {data.subnetMask}</p>
      <p>
        <strong>Subnet Mask (Binary):</strong> <span className="binary-mask">{data.binaryMask}</span>
      </p>
      <p><strong>Prefix Length:</strong> /{data.cidr}</p>
      <p><strong>Usable Hosts:</strong> {data.usableHosts}</p>
    </div>
  );
}

function SubnetResult({ data }) {
  return (
    <div className="subnet-result">
      {data.requiredHosts !== null && (
        <h3>Subnet for {data.requiredHosts} hosts (/{data.cidr})</h3>
      )}
      <p><strong>Network Address:</strong> {data.networkAddress}</p>
      <p><strong>Broadcast Address:</strong> {data.broadcastAddress}</p>
      <p><strong>First Host:</strong> {data.firstHost}</p>
      <p><strong>Last Host:</strong> {data.lastHost}</p>
      <p><strong>Total Hosts:</strong> {data.totalHosts}</p>
      <p><strong>Subnet Mask:</strong> {data.subnetMask}</p>
    </div>
  );
}

function DetailedSubnetResult({ subnet }) {
  return (
    <div className="subnet-result">
      <h3>Subnet for {subnet.hosts} hosts (/{subnet.cidr})</h3>
      <p><strong>Network Address:</strong> {subnet.network}/{subnet.cidr}</p>
      <p><strong>Usable Host Range:</strong> {subnet.firstHost} - {subnet.lastHost}</p>
      <p><strong>Broadcast Address:</strong> {subnet.broadcast}</p>
      <p><strong>Total Hosts:</strong> {subnet.totalHosts} ({subnet.size} total addresses)</p>
      <p><strong>Subnet Mask:</strong> {subnet.mask}</p>
    </div>
  );
}

function CompactSubnetTable({ subnets }) {
  return (
    <div className="subnet-table">
      <table>
        <thead>
          <tr>
            <th>For Hosts</th>
            <th>Network</th>
            <th>First Host</th>
            <th>Last Host</th>
            <th>Broadcast</th>
            <th>Mask</th>
            <th>CIDR</th>
          </tr>
        </thead>
        <tbody>
          {subnets.map((subnet) => (
            <tr key={`${subnet.network}/${subnet.cidr}`}>
              <td>{subnet.hosts}</td>
              <td>{subnet.network}/{subnet.cidr}</td>
              <td>{subnet.firstHost}</td>
              <td>{subnet.lastHost}</td>
              <td>{subnet.broadcast}</td>
              <td>{subnet.mask}</td>
              <td>/{subnet.cidr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworkSummary({ data }) {
  const remainingPct = Math.round((data.remaining / data.parentSize) * 100);
  const allocatedPct = Math.round((data.totalAllocated / data.parentSize) * 100);

  return (
    <div className="network-summary">
      <p><strong>Parent Network:</strong> {data.parentNetwork}/{data.parentCidr}</p>
      <p><strong>Total Allocated:</strong> {data.totalAllocated} addresses ({allocatedPct}%)</p>
      {data.remaining < 0 ? (
        <p className="error">
          <strong>Warning:</strong> Network overallocated by {-data.remaining} addresses
        </p>
      ) : (
        <p><strong>Remaining Addresses:</strong> {data.remaining} ({remainingPct}%)</p>
      )}
    </div>
  );
}
