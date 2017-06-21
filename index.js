BASE_DNS_LOOKUP_URL = "https://dns-api.org/"

EXCHANGE_ONLINE_DNS_VALUE_MAP = {
  mx: 'outlook.com',
  txt: 'include:spf.protection.outlook.com'
}

/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabDomain(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;
    var hostname = new URL(url).hostname;
    var hostnameParts = hostname.split('.')

    var domain = null

    if (hostnameParts.length > 2) {
      hostnameParts.shift()
      domain = hostnameParts.join('.')
    } else {
      domain = hostnameParts.join('.')
    }

    return callback(domain);
  });
}

function getDNSRecords(domain, callback) {
  var mxLookupUrl = BASE_DNS_LOOKUP_URL + 'MX/' + domain
  var txtLookupUrl = BASE_DNS_LOOKUP_URL + 'TXT/' + domain
  var recordsMap = {}
  $.ajax(mxLookupUrl, {headers: {"Access-Control-Allow-Origin": '*'}})
    .done(function(mxRecords) {
      recordsMap.mx = mxRecords;
      $.ajax(txtLookupUrl, {headers: {"Access-Control-Allow-Origin": '*'}})
        .done(function(txtRecords) {
          recordsMap.txt = txtRecords;
          return callback(null, recordsMap);
        })
      .error(function(err) {
        console.log('Error in TXT record lookup: ', err);
        return callback(err);
      })
    })
    .error(function(err) {
      console.log('Error in MX record lookup: ', err);
      return callback(err);
    })
}

function includesExchangeOnline(records, recordType) {
  for (recordIndex in records) {
    var recordValue = records[recordIndex].value
    if (recordValue && recordValue.match(EXCHANGE_ONLINE_DNS_VALUE_MAP[recordType])) {
      return true
    }
  }

  return false
}

function usingExchangeOnline(recordsMap) {
  return includesExchangeOnline(recordsMap.mx, 'mx') || includesExchangeOnline(recordsMap.txt, 'txt')
}

function getExchangeType(domain, callback) {
  if (!domain) {return callback(new Error('Missing domain'))}
  getDNSRecords(domain, function(err, recordsMap){
    if (err) {
      return callback(err)
    }
    if (usingExchangeOnline(recordsMap)) {
      return callback(null, 'online')
    } else {
      return callback(null, 'unknown')
    }
  });
}

function renderStatus(status) {
  var statusElementString, statusText
  if (status === 'loading') {
    statusIcon = '<div class="small progress"><div>Loading…</div></div>'
    statusText = '<p>Looking up Exchange data...</p>'
  } else if (status === 'error') {
    statusIcon = '<img class="icon" src="img/error-icon.png">'
    statusText = '<p>Whoops, something went wrong...</p>'
  } else if (status === 'online') {
    statusIcon = '<img class="icon" src="img/success-icon.png">'
    statusText = '<p>You found one! This company uses Exchange online</p>'
  } else {
    statusIcon = '<img class="icon" src="img/question-icon.png">'
    statusText = '<p>This company may not use Office 365. Check out the additional resources for more info!</p>'
  }

  $('#status').html(statusText);
  $('#status-icon').html(statusIcon);
}

document.addEventListener('DOMContentLoaded', function() {
  getCurrentTabDomain(function(domain) {
    $('#domain-name').text(domain);
    renderStatus('loading');
    getExchangeType(domain, function(err, exchangeType) {
      if (err) {
        console.log('Error: ', err)
        renderStatus('error')
      } else {
        renderStatus(exchangeType)
      }
    });
  });
});
