#include "RuleLangResult.hpp"

RuleLangResult::RuleLangResult(shared_ptr<IGeneratorMeta> meta,
                               shared_ptr<Rule> rule,
                               vector<shared_ptr<ILangResult>> subs)
    : LangResult(std::move(meta)), _rule(std::move(rule)),
      _subs(std::move(subs)) {}

shared_ptr<Rule> &RuleLangResult::rule() { return this->_rule; }
vector<shared_ptr<ILangResult>> &RuleLangResult::subs() { return this->_subs; }

LangListPointer RuleLangResult::result() { return result(true); };
LangListPointer RuleLangResult::result(bool cached) {
  if (cached) {
    if (this->_result == nullptr) {
      this->_result = _generate();
    }
    return this->_result;
  } else {
    return _generate();
  }
};

LangListPointer RuleLangResult::_generate() {
  size_t subs_sz = _subs.size();
  if (_rule == nullptr || subs_sz == 0) {
    return std::make_shared<LangList>();
  }
  // init
  vector<LangListPointer> sub_results{}; // data holder
  vector<LangList::const_iterator> begins{};
  vector<LangList::const_iterator> ends{};
  LangListPointer result = std::make_shared<LangList>();
  const string &s_fmt = _rule->source();
  const string &t_fmt = _rule->target();
  do {
    // fill zeros
    for (size_t i = begins.size(); i < subs_sz; ++i) {
      auto sub_result = _subs[i].get()->result();
      if (sub_result->cbegin() == sub_result->cend()) {
        // zero-len sub, not valid
        return std::make_shared<LangList>();
      }
      begins.push_back(sub_result->cbegin());
      ends.push_back(sub_result->cend());
      sub_results.push_back(std::move(sub_result));
    }
    // generate
    fmt::dynamic_format_arg_store<fmt::format_context> s_store, t_store;
    for (const auto &citor : begins) {
      s_store.push_back(citor->first);
      t_store.push_back(citor->second);
    }
    result->emplace_back(fmt::vformat(s_fmt, s_store),
                         fmt::vformat(t_fmt, t_store));
    // step
    for (size_t i = subs_sz; i > 0; --i) {
      if (++begins[i - 1] == ends[i - 1]) {
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
