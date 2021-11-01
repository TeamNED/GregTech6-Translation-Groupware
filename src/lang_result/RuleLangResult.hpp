#ifndef RULELANGRESULT_H
#define RULELANGRESULT_H
#pragma once

#include <fmt/args.h>
#include <fmt/core.h>

#include "../generator/Rule.hpp"
#include "LangResult.hpp"

class RuleLangResult : public virtual LangResult {
  using LangResult::LangResult;

private:
  shared_ptr<Rule> _rule;
  vector<shared_ptr<ILangResult>> _subs;
  LangListPointer _result = nullptr;

  LangListPointer RuleLangResult::_generate();

public:
  RuleLangResult(shared_ptr<IGeneratorMeta> meta, shared_ptr<Rule> rule,
                 vector<shared_ptr<ILangResult>> subs);
  virtual shared_ptr<Rule> &rule();
  virtual vector<shared_ptr<ILangResult>> &subs();
  virtual LangListPointer result() override;
  virtual LangListPointer result(bool cached);
};
#endif