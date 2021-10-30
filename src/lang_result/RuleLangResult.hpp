#ifndef RULELANGRESULT_H
#define RULELANGRESULT_H
#pragma once

#include "../generator/Rule.hpp"
#include "LangResult.hpp"

class RuleLangResult : public virtual LangResult {
  using LangResult::LangResult;

private:
  shared_ptr<Rule> _rule;
  vector<shared_ptr<ILangResult>> _subs;
  pkvlist _result = nullptr;

  pkvlist RuleLangResult::_generate();

public:
  RuleLangResult(shared_ptr<IGeneratorMeta> meta, shared_ptr<Rule> rule,
                 vector<shared_ptr<ILangResult>> subs);
  virtual shared_ptr<Rule> &rule();
  virtual vector<shared_ptr<ILangResult>> &subs();
  virtual pkvlist result() override;
  virtual pkvlist result(bool cached);
};
#endif