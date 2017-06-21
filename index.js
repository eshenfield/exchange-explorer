BASE_DNS_LOOKUP_URL = "https://dns-api.org/"

EXCHANGE_ONLINE_DNS_VALUE_MAP = {
  mx: {
    'outlook.com': 'exchangeOnline',
    'google.com': 'gmail'
  },
  txt: {
    'include:spf.protection.outlook.com': 'exchangeOnline'
  }
}

/**
 * Get the current tab's URL and parse the domain from it.
 *
 * @param {function(string)} callback - called when the domain of the current tab
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

/**
 * Gets MX and TXT records for a given domain.
 *
 * @param {string} domain
 * @param {function(err, object)} callback - called with a map of txt/mx records
 *
 */
function getDNSRecords(domain, callback) {
  var mxLookupUrl = BASE_DNS_LOOKUP_URL + 'MX/' + domain
  var txtLookupUrl = BASE_DNS_LOOKUP_URL + 'TXT/' + domain
  var recordsMap = {}

  $.ajax(mxLookupUrl, {headers: {"Access-Control-Allow-Origin": '*'}})
    .done(function(mxRecords) {

      if (mxRecords.error) {
        console.log('Error in MX record lookup: ', mxRecords.error);
        return callback(mxRecords.error);
      }

      recordsMap.mx = mxRecords;

      $.ajax(txtLookupUrl, {headers: {"Access-Control-Allow-Origin": '*'}})
        .done(function(txtRecords) {

          if (txtRecords.error) {
            console.log('Error in TXT record lookup: ', txtRecords.error);
            return callback(txtRecords.error);
          }

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

/**
 * Checks a specific type of record for a matching string indicating an email provider
 *
 * @param {object} records - keyed by matching string with a value of the correlated email provider
 * @param {string} recordType - the type of record, either txt or mx
 *
 */
function checkDNSForProvider(records, recordType) {
  for (var record of records) {
    for (var key in EXCHANGE_ONLINE_DNS_VALUE_MAP[recordType]) {
      if (record.value && record.value.match(key)) {
        return EXCHANGE_ONLINE_DNS_VALUE_MAP[recordType][key]
      }
    }
  }

  return null
}

/**
 * Gets the email provider given a map of mx and txt records for a domain
 *
 * @param {object} recordsMap - of the form {txt: {}, mx: {}}
 *
 */
function parseEmailProvider(recordsMap) {
  return checkDNSForProvider(recordsMap.mx, 'mx') || checkDNSForProvider(recordsMap.txt, 'txt')
}

/**
 * Given a domain, gets dns records and then determines email provider, if possible
 *
 * @param {object} recordsMap - of the form {txt: {}, mx: {}}
 *
 */
function getEmailProvider(domain, callback) {
  if (!domain) {return callback(new Error('Missing domain'))}

  getDNSRecords(domain, function(err, recordsMap) {
    if (err) {
      return callback(err)
    }
    return callback(null, parseEmailProvider(recordsMap))
  });
}

/**
 * Renders correlated message based on a given status
 *
 * @param {status} string - could be: loading, error, exchangeOnline, gmail, or null
 *
 */
function render(status) {
  var statusElementString, statusText
  if (status === 'loading') {
    statusIcon = '<div class="small progress"><div>Loading…</div></div>'
    statusText = '<p>Looking up email provider data...</p>'
  } else if (status === 'error') {
    statusIcon = '<img class="icon" src="img/error-icon.png">'
    statusText = '<p>Whoops, something went wrong...</p>'
  } else if (status === 'exchangeOnline') {
    statusIcon = '<img class="icon" src="img/office-365-logo.png">'
    statusText = '<p>This domain uses Office 365</p>'
  } else if (status === 'gmail') {
    statusIcon = '<img class="icon" src="img/gmail-logo.png">'
    statusText = '<p>This domain uses Gmail</p>'
  } else {
    statusIcon = '<img class="icon" src="img/question-icon.png">'
    statusText = '<p>This domain may not use Office 365. Check out the additional resources for more info!</p>'
  }

  $('#status').html(statusText);
  $('#status-icon').html(statusIcon);
}

document.addEventListener('DOMContentLoaded', function() {
  getCurrentTabDomain(function(domain) {
    $('#domain-name').text(domain);
    render('loading');
    getEmailProvider(domain, function(err, emailProvider) {
      if (err) {
        console.log('Error: ', err)
        render('error')
      } else {
        render(emailProvider)
      }
    });
  });
});
