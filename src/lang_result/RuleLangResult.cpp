#include "RuleLangResult.hpp"

RuleLangResult::RuleLangResult(shared_ptr<IGeneratorMeta> meta,
                               shared_ptr<Rule> rule,
                               vector<shared_ptr<ILangResult>> subs)
    : LangResult(meta), _rule(rule), _subs(subs) {}

shared_ptr<Rule> &RuleLangResult::rule() { return this->_rule; }
vector<shared_ptr<ILangResult>> &RuleLangResult::subs() { return this->_subs; }

pkvlist RuleLangResult::result() { return result(true); };
pkvlist RuleLangResult::result(bool cached) {
  if (cached) {
    if (this->_result == nullptr) {
      this->_result = _generate();
    }
    return this->_result;
  } else {
    return _generate();
  }
};

pkvlist RuleLangResult::_generate() {
  size_t subs_sz = _subs.size();
  if (_rule == nullptr || subs_sz == 0) {
    return std::make_shared<kvlist>();
  }
  // init
  vector<pkvlist> sub_results{}; // data holder
  vector<kvlist::const_iterator> begins{};
  vector<kvlist::const_iterator> ends{};
  pkvlist result = std::make_shared<kvlist>();
  const string &s_fmt = _rule->source();
  const string &t_fmt = _rule->target();
  do {
    // fill zeros
    for (size_t i = begins.size(); i < subs_sz; ++i) {
      auto sub_result = _subs[i].get()->result();
      if (sub_result->cbegin() == sub_result->cend()) {
        // zero-len sub, not valid
        return std::make_shared<kvlist>();
      }
      begins.emplace_back(sub_result->cbegin());
      ends.emplace_back(sub_result->cend());
      sub_results.emplace_back(std::move(sub_result));
    }
    // generate
    fmt::dynamic_format_arg_store<fmt::format_context> s_store, t_store;
    for (const auto &citor : begins) {
      s_store.push_back(citor->first);
      t_store.push_back(citor->second);
    }
    result->insert({fmt::vformat(s_fmt, s_store), //
                    fmt::vformat(t_fmt, t_store)});
    // step
    for (size_t i = subs_sz - 1; i >= 0; --i) {
      if (++begins[i] == ends[i]) {
        begins.pop_back();
        ends.pop_back();
        sub_results.pop_back();
      } else {
        break;
      }
    }
  } while (begins.size() > 0);
  return result;
}
